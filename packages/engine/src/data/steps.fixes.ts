import type { StepInput } from '../domain';
import type { Condition } from '../condition';
import { nohal, servicePage, fieldReport, inferred } from './sources';

/**
 * ============================================================================
 * שלבי תיקון — what has to be put right before the road can be walked
 * ============================================================================
 *
 * ⭐ Chaya's design, 30.8:
 *   "Let's say the user inputs his information with the documents, and then
 *    they realize that he has to change his name. That should be the next step
 *    for him."
 *
 * A document problem is not a warning printed beside the road. It IS the road,
 * at the front of it. Same principle already written for the visa in גיליון F0:
 *   "אשרה שפג תוקפה אינה הערת שוליים במפת הדרכים — היא הופכת לשלב הראשון בה."
 *
 * ⭐ Why these are STEPS and not more UrgentIssues. A step can carry a
 * prerequisite, and prerequisites are the whole point here. Chaya's own case:
 * she went to update her 89 and was turned away because her visa had expired,
 * so she renewed the visa and came back. Two trips, because she learned about
 * her problems one at a time.
 *
 * `fix.update_89.must_come_after = ['fix.renew_visa']` says that once, and the
 * engine does the rest. And because `waiting_on` only counts steps actually on
 * HIS road, a person whose visa is fine never sees the dependency at all.
 *
 * ⚠️ track: 'both'. None of this is about converting or starting from zero. It
 * is about the documents in his hand, which are the same either way.
 *
 * ⚠️ sequence_position 0 and below. These come before step one of either route,
 * because they are what makes step one possible.
 */

/**
 * ⭐ A FIX STEP IS OPT-IN ON EVIDENCE. THE REST OF THE ENGINE IS OPT-OUT ON DOUBT.
 *
 * ⚠️ Learned the hard way on 30.8: fix.update_89 appeared on EVERY roadmap as
 * 'uncertain', because nobody had typed a passport number yet and the engine's
 * standing rule is to keep a step it cannot place. Four tests caught it.
 *
 * That rule is correct for a requirement. Showing a step he might not need
 * costs him a question; hiding one he does need costs him a wasted trip, so
 * unknown keeps it.
 *
 * ⭐ For a FIX the arithmetic reverses. Telling somebody his documents might be
 * broken, when we simply never asked, is alarming and useless — and it is the
 * same sin as rendering unknown as no, pointed the other way. So a fix appears
 * only once we KNOW. `is_known` makes the whole condition false while the
 * answer is missing, instead of 'unknown'.
 *
 * Both defaults are the safe direction for their own kind of step.
 */
function knownAndFalse(field: 'visa_valid_now' | 'passport_89_number_match' | 'passport_89_name_match' | 'passport_license_name_match'): Condition {
  return {
    all: [
      { field, op: 'is_known' },
      { field, op: 'eq', value: false },
    ],
  };
}

const VISA_EXPIRED: Condition = knownAndFalse('visa_valid_now');

const NUMBERS_DISAGREE: Condition = knownAndFalse('passport_89_number_match');

export const FIX_STEPS: StepInput[] = [
  {
    id: 'fix.renew_visa',
    // Renewing the visa also repairs "דרכון עם אשרת שהייה בתוקף", which is
    // broken by a lapsed visa as surely as by an expired passport.
    repairs_documents: ['doc.visa', 'doc.passport'],
    track: 'both',
    title: { he: "חידוש האשרה", en: 'Renew your visa' },
    action: {
      he: "חדש את אשרת השהייה מול רשות האוכלוסין וההגירה. החידוש מקוון ואורך כחודש.",
      en: 'Renew your residence visa with the Population and Immigration Authority. It is done online and takes about a month.',
    },
    applies_when: VISA_EXPIRED,
    sequence_position: -20,
    act_when: 'start_now',
    channel: 'population_authority',
    authority: "רשות האוכלוסין וההגירה",
    lead_time_days: 30,
    links: [
      {
        label: { he: "רשות האוכלוסין", en: 'Population and Immigration Authority' },
        url: 'https://www.gov.il/he/departments/population_and_immigration_authority',
      },
    ],
    notes: [
      {
        he: "⚠️ זה קודם לכל השאר, כולל עדכון מסמך ה-89. כל עוד האשרה אינה בתוקף, גם עדכון המסמכים עצמו לא יתבצע.",
        en: '⚠️ This comes before everything else, including updating your 89 document. While the visa is not valid, even updating your documents will not go through.',
      },
    ],
    evidence: [
      nohal(
        "ס' 1(ג)",
        "הזכאות נבחנת לרגע ההגשה — נדרש רישיון ישיבה בתוקף בעת הגשת הבקשה",
        "תושב מדינת חוץ שהגיש את בקשתו בעת שהיה ברשותו רישיון ישיבה בישראל.",
      ),
      // ⭐ The highest generalisability in the model. Not a licensing quirk:
      // an invalid visa blocks every dealing with the Israeli state.
      fieldReport(
        "אשרה שאינה בתוקף חוסמת כל התנהלות מול רשויות המדינה, ולכן גם את עדכון מסמך ה-89 עצמו",
        { generalizability: 'pattern' },
      ),
      fieldReport("חידוש אשרה מתבצע מקוון ואורך חודש לפחות", {
        varies_by: ['clerk_discretion'],
      }),
    ],
  },

  {
    id: 'fix.update_89',
    repairs_documents: ['doc.form_89'],
    track: 'both',
    title: { he: "עדכון מסמך ה-89 לדרכון הנוכחי", en: 'Update your 89 document to your current passport' },
    action: {
      he: "קבע תור למשרד הרישוי והצג את הדרכון החדש. הפקיד מדפיס מסמך 89 מעודכן. כדאי להביא גם את הדרכון הישן אם הוא עדיין בידך.",
      en: 'Book a licensing office appointment and show your new passport. The clerk prints an updated 89. Bring the old passport too if you still have it.',
    },
    applies_when: NUMBERS_DISAGREE,
    sequence_position: -10,
    act_when: 'start_now',
    /**
     * ⭐ THE LINE THIS FILE EXISTS FOR. Chaya went to update her 89 and was
     * turned away because her visa had expired. One declaration, and nobody
     * repeats her second trip.
     */
    must_come_after: ['fix.renew_visa'],
    channel: 'licensing_office',
    authority: "משרד הרישוי",
    requires_appointment: true,
    requires_documents: ['doc.passport', 'doc.form_89'],
    notes: [
      {
        he: "⭐ מספר ה-89 עצמו קבוע ואינו משתנה לעולם. מה שמתעדכן הוא רק הקישור שלו לדרכון החדש.",
        en: '⭐ The 89 number itself is permanent and never changes. All that is updated is its link to your new passport.',
      },
      {
        // ⚠️ Contrast worth stating: the first issue is a walk-in, this is not.
        he: "⚠️ העדכון מחייב תור, בניגוד להנפקה הראשונה שהיא כניסה חופשית.",
        en: '⚠️ This update requires an appointment, unlike the first issue, which is a walk-in.',
      },
    ],
    checklist: [
      {
        he: "הדרכון שבידך והמסמך 89 נושאים את אותו מספר דרכון",
        en: 'The passport in your hand and the 89 carry the same passport number',
      },
    ],
    evidence: [
      // ⭐ The most expensive consequence in the whole research, and it is hers.
      fieldReport(
        "אי-התאמה בין מספר הדרכון שבמסמך ה-89 לדרכון שברשות הנבחן מונעת את קיום הטסט, והוא נרשם ככישלון ולא כאי-התייצבות",
      ),
      fieldReport(
        "מספר ה-89 עצמו קבוע — חידוש דרכון שובר רק את הקישור, והעדכון מחייב תור",
        { generalizability: 'corroborated' },
      ),
    ],
  },

  {
    id: 'fix.name_on_89',
    repairs_documents: ['doc.form_89'],
    track: 'both',
    title: { he: "בדיקת השם במסמך ה-89 מול הדרכון", en: 'Check the name on your 89 against your passport' },
    action: {
      he: "השם במסמך ה-89 ובדרכון אינו נקרא אותו הדבר. גש למשרד הרישוי עם הדרכון וברר אם יש לעדכן את המסמך.",
      en: 'The name on your 89 and the name in your passport do not read the same. Take your passport to the licensing office and ask whether the document needs updating.',
    },
    applies_when: knownAndFalse('passport_89_name_match'),
    sequence_position: -9,
    act_when: 'start_now',
    channel: 'licensing_office',
    authority: "משרד הרישוי",
    notes: [
      {
        // ⚠️ Honest about what the system can and cannot tell.
        he: "⚠️ ההשוואה מתעלמת מסדר השמות, מרווחים ומסימני ניקוד — \"SMITH JOHN\" ו-\"John Smith\" נחשבים זהים. אם בכל זאת עלה הבדל, מדובר בכתיב שונה ממש. אנחנו לא יכולים לדעת אם הפקיד יקבל אותו, ולכן זו בדיקה ולא אזהרה.",
        en: '⚠️ The comparison ignores name order, spacing and accents: "SMITH JOHN" and "John Smith" count as identical. So a difference here is a genuinely different spelling. We cannot know whether a clerk will accept it, which is why this is a check and not a warning.',
      },
    ],
    evidence: [
      inferred(
        "מסמכים הנושאים כתיב שונה של אותו שם יוצרים חיכוך בדלפק",
        'גיליון 03 שורה 3 · הסקה מדרישת ההתאמה בין הדרכון לרישום ברשות האוכלוסין',
      ),
    ],
  },

  {
    id: 'fix.name_on_license',
    repairs_documents: ['doc.foreign_license'],
    track: 'conversion',
    title: { he: "בדיקת השם ברישיון הזר מול הדרכון", en: 'Check the name on your foreign licence against your passport' },
    action: {
      he: "השם ברישיון הנהיגה הזר ובדרכון אינו נקרא אותו הדבר. ודא מול משרד הרישוי לפני ההגשה שהם מקבלים את ההבדל, או הבא תרגום נוטריוני שמראה שמדובר באותו אדם.",
      en: 'The name on your foreign licence and the name in your passport do not read the same. Check with the licensing office before submitting whether they accept the difference, or bring a notarised translation showing it is the same person.',
    },
    applies_when: knownAndFalse('passport_license_name_match'),
    sequence_position: -8,
    act_when: 'start_now',
    channel: 'licensing_office',
    authority: "משרד הרישוי",
    notes: [
      {
        // ⭐ The reason this exists at all, spelled out for the person it hits.
        he: "⭐ זה קורה הכי הרבה כששם נכתב במקור באלפבית אחר — קירילי, אמהרי, ערבי, סיני. כל מסמך מתעתק אותו בנפרד, והתוצאות לא זהות. זו לא טעות שלך.",
        en: '⭐ This happens most often when a name was originally written in another alphabet: Cyrillic, Amharic, Arabic, Chinese. Each document transliterates it separately and the results do not match. It is not a mistake you made.',
      },
    ],
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "נדרש שהשם יהיה מעודכן באנגלית ברשות האוכלוסין",
        "יש לוודא כי שמם של מגישי הבקשה מעודכן בשפה האנגלית ברשות האוכלוסין וההגירה.",
      ),
      inferred(
        "כתיב שונה בין הרישיון הזר לדרכון יוצר חיכוך בהמרה",
        'גיליון 05 שורה 13 · הסקה מדרישת ההתאמה',
      ),
    ],
  },
];
