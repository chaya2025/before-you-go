import { RECORD_RELEVANT } from './rules';
import type { RequiredDocumentInput } from '../domain';
import type { Condition } from '../condition';
import { nohal, servicePage, official, fieldReport, notChecked } from './sources';

/**
 * ============================================================================
 * DOCUMENTS
 * ============================================================================
 *
 * Source: גיליון 05_מסמכים.
 *
 * ⭐ The headline finding of that sheet, and it is good news the user never hears
 * anywhere else: the OFFICIAL list is far shorter than what כל-זכות and the
 * commercial sites demand. For a תושב מדינת חוץ the נוהל asks for three things.
 *
 * ⭐ And the list for a תושב מדינת חוץ contains no teudat zehut at all. The
 * procedure was written, from the start, for people who do not have one.
 */

const CONVERTING: Condition = { field: 'track', op: 'eq', value: 'conversion' };
const NO_TEUDAT_ZEHUT: Condition = { field: 'has_teudat_zehut', op: 'eq', value: false };
const FOREIGN_RESIDENT: Condition = {
  field: 'nohal_category',
  op: 'eq',
  value: 'toshav_medinat_chutz',
};

/**
 * ⭐ `held_when` / `broken_when` — added 31.8 for the readiness report.
 *
 * `applies_when` answers "does this person need this document?".
 * These two answer "and does he have it, and will it work?".
 *
 * ⚠️ Three answers, and the third is the one that matters. A document whose
 * `held_when` comes back 'unknown' is NOT missing — nobody asked. It is reported
 * as unconfirmed and stays visibly separate from the things he genuinely lacks,
 * because telling a man he is missing a passport we never asked about is
 * principle 8 ("אל תציגי 'לא ידוע' כ'לא'") pointed at his documents.
 *
 * ⚠️ Documents nothing in the profile can speak to declare NEITHER. The glasses
 * and the payment receipt are honestly unconfirmed and it would be a lie to
 * compute anything else about them.
 */

export const DOCUMENTS: RequiredDocumentInput[] = [
  {
    /**
     * ⚠️ Added 27.8. Filtering documents per person exposed a hole: a citizen
     * on the from-zero route was told to bring nothing at all, because
     * doc.passport is scoped to foreign residents. The photo station and the
     * test both want photo ID from EVERYONE — the gov.il page lists three
     * acceptable ones and does not care which.
     */
    id: 'doc.identity',
    name: { he: "תעודה מזהה בתוקף", en: 'Valid photo ID' },
    applies_when: { always: true },
    issued_by: { he: "—", en: '—' },
    must_be_original: true,
    notes: {
      he: "תעודת זהות, דרכון או רישיון נהיגה — כל אחד מהם מתקבל.",
      en: 'A teudat zehut, a passport or a driving licence — any of the three is accepted.',
    },
    /**
     * Any ONE of the three is enough, which is what `any` is for: one true
     * settles it, and only if none is true and something is unanswered does the
     * whole thing come back unknown.
     */
    held_when: {
      any: [
        { field: 'has_teudat_zehut', op: 'eq', value: true },
        { field: 'passport_valid_now', op: 'eq', value: true },
        { field: 'foreign_license_valid', op: 'eq', value: true },
      ],
    },
    evidence: [
      official(
        'דף "תחנות צילום לרישיון נהיגה", משרד התחבורה',
        "מסמכי הזיהוי המתקבלים",
        "תעודה מזהה בתוקף: תעודת זהות, דרכון או רישיון נהיגה.",
        'https://www.gov.il/he/service/drivers_license_photo_stations',
      ),
    ],
  },

  {
    id: 'doc.foreign_license',
    name: { he: "רישיון נהיגה לאומי בתוקף", en: 'A valid national driving licence' },
    applies_when: CONVERTING,
    issued_by: { he: "מדינת המוצא", en: 'Your home country' },
    must_be_original: true,
    notes: {
      // ⚠️ Two separate traps in one document.
      he: "⚠️ לאומי בלבד — רישיון בין-לאומי (IDP) אינו מתקבל להמרה. ⚠️ ובתוקף, לא רק קיים.",
      en: '⚠️ National only. An International Driving Permit is not accepted for conversion. ⚠️ And valid, not merely in your possession.',
    },
    /** He said he holds a national licence. That is the document itself. */
    held_when: { field: 'foreign_license_kind', op: 'eq', value: 'national' },
    /**
     * ⭐ The quiet one. cc.foreign_license_valid names the scenario: the רקורד
     * takes months and the licence can expire while he waits for it, so he
     * arrives holding a document that is no longer convertible. It is his
     * central document and nothing was checking it at the summary level.
     */
    broken_when: { field: 'foreign_license_valid', op: 'eq', value: false },
    evidence: [
      nohal(
        "פרק \"מסמכים נדרשים\" — מופיע בשלוש הרשימות",
        "נדרש רישיון נהיגה לאומי בתוקף",
        "רישיון נהיגה לאומי בתוקף.",
      ),
      nohal(
        "פרק \"הערות\", תבליט 1",
        "רישיון בין-לאומי אינו מתקבל להמרה",
        "אין להציג רישיון נהיגה בין לאומי לצורך המרה אלא רק רישיון לאומי.",
      ),
    ],
  },

  {
    id: 'doc.passport',
    name: { he: "דרכון עם אשרת שהייה בתוקף", en: 'Passport with a valid residence visa' },
    applies_when: FOREIGN_RESIDENT,
    issued_by: { he: "מדינת המוצא + רשות האוכלוסין", en: 'Your home country + the Population Authority' },
    must_be_original: true,
    notes: {
      he: "האשרה חייבת להיות בתוקף ברגע ההגשה — הזכאות נבחנת ליום ההגשה ולא ליום הכניסה.",
      en: 'The visa must be valid at the moment you submit. Eligibility is judged on the day you apply, not the day you entered.',
    },
    /**
     * ⚠️ Validity, not possession. Everyone holding this visa document holds a
     * passport; what decides whether it works at the desk is the expiry date he
     * transcribed. An unanswered expiry is genuinely unconfirmed.
     */
    held_when: {
      all: [
        { field: 'passport_valid_now', op: 'eq', value: true },
        { field: 'visa_valid_now', op: 'eq', value: true },
      ],
    },
    /**
     * ⚠️ BOTH halves, and the visa half was missing until the readiness report
     * was read on 31.8. This document is not "a passport"; it is named
     * "דרכון עם אשרת שהייה בתוקף", and its own note says the visa must be valid
     * at the moment of submission. Checking only the passport produced a screen
     * that listed the visa as broken and, four lines below, this document as in
     * order — two contradictory statements about the same piece of paper.
     *
     * ⭐ Exactly the shape of the bug Chaya found on 30.8, where one roadmap
     * told her both to obtain her 89 and to update it. A document is only in
     * order when everything its own definition requires is in order.
     */
    broken_when: {
      any: [
        { field: 'passport_valid_now', op: 'eq', value: false },
        { field: 'visa_valid_now', op: 'eq', value: false },
      ],
    },
    evidence: [
      nohal(
        "פרק \"מסמכים נדרשים\" ← \"תושב מדינת חוץ\", ס' 2",
        "נדרש דרכון עם אשרת שהייה בתוקף",
        "דרכון עם אשרת שהייה בתוקף.",
      ),
    ],
  },

  {
    id: 'doc.visa',
    name: { he: "אשרת שהייה בתוקף", en: 'A valid residence visa' },
    applies_when: NO_TEUDAT_ZEHUT,
    issued_by: { he: "רשות האוכלוסין וההגירה", en: 'The Population and Immigration Authority' },
    must_be_original: true,
    notes: {
      he: "נדרשת בכל פעולה מול משרד הרישוי, לא רק בהגשה הראשונה.",
      en: 'Required at every interaction with the licensing office, not only at first submission.',
    },
    held_when: { field: 'visa_valid_now', op: 'eq', value: true },
    broken_when: { field: 'visa_valid_now', op: 'eq', value: false },
    evidence: [
      nohal(
        "ס' 1(ג)",
        "רישיון ישיבה בתוקף הוא תנאי הזכאות עצמו",
        "תושב מדינת חוץ שהגיש את בקשתו בעת שהיה ברשותו רישיון ישיבה בישראל.",
      ),
    ],
  },

  {
    id: 'doc.form_89',
    name: { he: "מסמך 89 (\"הטופס הלבן\")", en: 'The 89 document (the "white form")' },
    applies_when: NO_TEUDAT_ZEHUT,
    issued_by: { he: "משרד הרישוי", en: 'The licensing office' },
    must_be_original: true,
    notes: {
      he: "דף A4 מודפס — מסמך נפרד שאפשר לאבד, לא חותמת בדרכון. ⚠️ המספר משמש אך ורק במשרד הרישוי: לא בביטוח לאומי, לא ברשות האוכלוסין, ולא בקופת חולים. ⭐ אין לו תאריך תפוגה: הדבר היחיד שיכול לשבור אותו הוא חידוש דרכון, שמשנה את מספר הדרכון שמודפס עליו.",
      en: 'A printed A4 sheet, a separate document you can lose, not a stamp in your passport. ⚠️ The number is used only at the licensing office: not at National Insurance, the Population Authority, or your health fund. ⭐ It has no expiry date: the only thing that can break it is renewing your passport, which changes the passport number printed on it.',
    },
    /** ⭐ You cannot know your 89 number without the document in front of you. */
    held_when: { field: 'holds_form_89', op: 'eq', value: true },
    /**
     * ⭐⭐ THE MISMATCH THIS WHOLE PRODUCT IS BUILT AROUND, said once at the
     * summary level. The 89 carries no expiry — Chaya checked hers on 30.8 —
     * so a stale passport number and a divergent name are the ONLY two ways it
     * can break. This condition is therefore the complete list.
     */
    broken_when: {
      any: [
        { field: 'passport_89_number_match', op: 'eq', value: false },
        { field: 'passport_89_name_match', op: 'eq', value: false },
      ],
    },
    evidence: [
      servicePage(
        "הוצאת רישיון נהיגה לעובד זר",
        "משרד הרישוי מנפיק מספר זיהוי המתחיל ב-89",
        "במשרד הרישוי יונפק מספר זיהוי פיקטיבי המתחיל בספרות 89.",
      ),
      fieldReport("המסמך הוא דף A4 מודפס, והמספר משמש רק במשרד הרישוי"),
      /**
       * ⭐ ⬜ CLOSED 30.8. The question was raised on 30.8 — does the 89 carry
       * an expiry date? — and deliberately left unanswered rather than guessed.
       * Chaya looked at hers:
       *
       *   "the 89 doesn't have an expiry date on it, only the actual 89 number
       *    and your passport number"
       *
       * ⭐ Which means the ONLY thing that can break an 89 is the passport
       * number on it going stale. There is no second way for it to lapse, and
       * no date to track. That makes urgent.passport_renewal_breaks_89 the
       * complete story rather than one case of several.
       */
      fieldReport(
        "מסמך ה-89 אינו נושא תאריך תפוגה — הוא נושא את מספר ה-89 ואת מספר הדרכון בלבד",
        { last_verified_at: '2026-08-30' },
      ),
      /**
       * ⭐ ⬜ CLOSED 31.8, one day after it was opened. The input rule needed a
       * length and the נוהל does not give one, so the first version capped it
       * arbitrarily and said in writing that the cap was an anti-paste guard
       * and NOT a claim about the document. Chaya then read her own 89:
       *
       *   "there are 9 digits in the 89"
       *
       * ⭐ Which is also what you would expect from the other direction: the
       * number substitutes for a teudat zehut number, and an Israeli identity
       * number is nine digits. Two independent reasons, one answer.
       */
      fieldReport(
        "מספר מסמך ה-89 בן תשע ספרות, ומתחיל בספרות 89",
        { last_verified_at: '2026-08-31' },
      ),
    ],
  },

  {
    id: 'doc.record',
    name: { he: "\"רקורד\" ממדינת המוצא", en: 'The "record" from your home country' },
    /**
     * ⭐ SCOPED 23.9 to match `cv.record`, from the one shared rule. It was
     * CONVERTING — every converter — while the step had already been narrowed,
     * so a two-year holder stopped seeing the step and went on being told to
     * bring the document. See RECORD_RELEVANT for the clause and the reasoning.
     */
    applies_when: RECORD_RELEVANT,
    /**
     * ⭐⭐ The נוהל offers this one. It never demands it.
     * "רקורד - למעוניינים בקבלת פטור ממבחן שליטה ובדיקת ראיה".
     */
    optional: {
      buys: {
        he: "פטור ממבחן שליטה ומבדיקת ראייה",
        en: 'Exemption from the control test and the eye test',
      },
      if_absent: {
        he: "המסמך אינו ברשותך. הוא אינו תנאי להמרה — הוא קונה פטור ממבחן שליטה ומבדיקת ראייה. בלעדיו המסלול נותר פתוח, בתוספת שתי הבדיקות.",
        en: 'You do not have it. It is not a condition of converting — it buys exemption from the control test and the eye test. Without it the route remains open, with those two tests included.',
      },
    },
    /**
     * ⭐ Most specific first. "I have started on it" is a real third state, and
     * only this document has four answers rather than three.
     */
    absence_variants: [
      {
        when: { field: 'has_record_document', op: 'eq', value: 'in_progress' },
        detail: {
          he: "ציינת שהתחלת בתהליך. המסמך מונפק על ידי רשות זרה, ולכן זמן ההמתנה לו הארוך ביותר במסלול. מומלץ להמשיך לטפל בו במקביל לשלבים האחרים — הוא אינו עוצר אותך.",
          en: 'You indicated that you have started the process. The document is issued by a foreign authority and has the longest waiting time in the route. Keep pursuing it alongside the other steps — it is not holding you up.',
        },
      },
      {
        /**
         * ⚠️ Open question 16, and the biggest practical blocker in this route.
         * The נוהל is silent, so the answer says so rather than inventing one.
         */
        when: {
          field: 'has_record_document',
          op: 'eq',
          value: 'origin_country_does_not_issue',
        },
        detail: {
          he: "ציינת שמדינת המוצא אינה מנפיקה מסמך כזה. הנוהל אינו מתייחס למקרה הזה ואין לנו תשובה מאומתת — זו שאלה פתוחה. מה שידוע: הרקורד נדרש רק לצורך הפטור, ולכן המסלול נותר פתוח בפניך, בתוספת מבחן שליטה ובדיקת ראייה.",
          en: 'You told us your home country does not issue one. The procedure does not address this case and we have no verified answer — it is an open question. What is known: the record is only ever needed for the exemption, so your route remains open, with the control test and the eye test included.',
        },
        // Nobody to ask. An action here would contradict the line above it.
        no_action: true,
      },
    ],
    issued_by: { he: "גורם מוסמך במדינת המוצא", en: 'A competent authority in your home country' },
    // ⭐ Not an original, and this is the one piece of good news in the whole
    // conversion route: it can be started remotely, today, by email.
    must_be_original: false,
    accepts_email: true,
    notes: {
      he: "נדרש רק למי שרוצה פטור ממבחן שליטה ומבדיקת ראייה. מתקבל בדוא\"ל, אז אפשר להתחיל מרחוק היום. ⚠️ חייב לציין את מועד הוצאת הרישיון הקבוע — לא את מועד הנפקת הכרטיס הנוכחי.",
      en: 'Only needed if you want exemption from the control test and eye test. Accepted by email, so you can start remotely today. ⚠️ It must state when your PERMANENT licence was issued, not when your current card was printed.',
    },
    /**
     * ⚠️ The only document the user is asked about directly, and the only one
     * with four possible answers rather than three. "I have started on it" and
     * "my country does not issue one" both come back as not-held here, and the
     * readiness report words them differently — the bucket is the same, the
     * advice is not.
     */
    held_when: { field: 'has_record_document', op: 'eq', value: 'yes' },
    evidence: [
      nohal(
        "פרק \"מסמכים נדרשים\" — מופיע בשלוש הרשימות",
        "אסמכתה מגורם מוסמך במדינת המוצא על מועד הוצאת הרישיון הקבוע, מתקבלת בדוא\"ל",
        "רקורד - למעוניינים בקבלת פטור ממבחן שליטה ובדיקת ראיה (בעלי רישיון נהיגה לאומי קבוע במשך חמש שנים לפחות, כאמור) נדרש להציג אסמכתה מגורם מוסמך ממדינת המוצא המציינת את מועד הוצאת רישיון הנהיגה הקבוע (ניתן גם באמצעות דוא\"ל).",
      ),
      // ⚠️ Open question 16, and the biggest practical blocker in this route.
      // Chaya has never seen one, which is exactly why the POC asks a yes/no
      // question about it rather than trying to read one.
      notChecked(
        "מיהו \"גורם מוסמך\", מה הפורמט, ומה עושה מי שמדינת המוצא אינה מנפיקה מסמך כזה",
      ),
    ],
  },

  {
    id: 'doc.teudat_oleh',
    name: { he: "תעודת עולה", en: 'Immigrant certificate' },
    applies_when: { field: 'nohal_category', op: 'eq', value: 'oleh_chadash' },
    issued_by: { he: "משרד העלייה והקליטה", en: 'The Ministry of Aliyah and Integration' },
    must_be_original: true,
    evidence: [
      nohal(
        "פרק \"מסמכים נדרשים\" ← \"עולה חדש\", ס' 2",
        "עולה חדש נדרש להציג תעודת עולה",
        "תעודת עולה.",
      ),
    ],
  },

  {
    id: 'doc.entry_exit_form',
    name: { he: "טופס כניסות ויציאות", en: 'Entries and exits form' },
    // ⚠️ ONE category only. כל-זכות demands it of everyone and contradicts the
    // נוהל — and a תושב מדינת חוץ is not merely exempt from it, he is not
    // entitled to request it at all.
    applies_when: { field: 'nohal_category', op: 'eq', value: 'toshav_israel' },
    issued_by: { he: "רשות האוכלוסין", en: 'The Population Authority' },
    must_be_original: true,
    notes: {
      he: "נדרש רק מתושב ישראל ששב מחו\"ל, כדי להוכיח שישה חודשים רצופים.",
      en: 'Required only from an Israeli resident returning from abroad, to prove six consecutive months.',
    },
    evidence: [
      nohal(
        "פרק \"מסמכים נדרשים\" ← \"תושב ישראל ששהה בחו\"ל לפחות 6 חודשים\", ס' 3",
        "הטופס מופיע רק ברשימה של תושב ישראל ששב, ולא ברשימות האחרות",
        "טופס כניסות ויציאות ממשרד הפנים.",
      ),
    ],
  },

  {
    id: 'doc.translation',
    name: { he: "תרגום נוטריוני", en: 'A notarised translation' },
    /**
     * ⭐ Was CONVERTING alone, so it was shown to every person converting a
     * licence regardless of what language it was written in. Nothing asked, so
     * nothing could know. Fixed 30.8 once the documents screen collects it.
     *
     * ⚠️ "ne en" and NOT "eq other", deliberately. An unanswered language
     * keeps the document on the list: the נוהל exempts English only, and
     * quietly dropping a requirement because nobody asked is the failure this
     * engine exists to avoid. Only a stated "it is in English" removes it.
     */
    applies_when: { all: [CONVERTING, { field: 'foreign_license_language', op: 'ne', value: 'en' }] },
    issued_by: { he: "עו\"ד או נוטריון דובר השפה", en: 'A lawyer or notary who speaks the language' },
    must_be_original: true,
    notes: {
      // ⚠️ "רשאית לדרוש" — an authority, not an obligation. We may never tell
      // someone he must obtain a translation.
      he: "רשות הרישוי רשאית לדרוש תרגום לכל מסמך שאינו באנגלית. רשאית — לא חייבת, ולא תמיד דורשת.",
      en: 'The licensing authority may require a translation of any document not in English. May — it is not automatic, and it is not always required.',
    },
    evidence: [
      nohal(
        "פרק \"הערות\", תבליט 4",
        "רשות הרישוי רשאית לדרוש תרגום — סמכות, לא חובה",
        "רשות הרישוי רשאית לדרוש תרגום של רישיון הנהיגה הלאומי, ו/או כל מסמך הנדרש לצורך המרת רישיון (מלבד אנגלית) התרגום יתבצע ע\"י עו\"ד/נוטריון דובר השפה.",
      ),
    ],
  },

  /**
   * ⚠️ doc.payment_receipt and doc.glasses were REMOVED on 31.8, and the two
   * removals are not the same kind of thing.
   *
   * ⭐ THE FEE RECEIPT was a stale official requirement. gov.il still lists it,
   * but Chaya has now reported twice that nobody asks — and the second time she
   * gave the mechanism: the fee is paid online and whoever books the test sees
   * it in the system. גיליון 13's "מי סמכותי למה" is explicit that for what
   * happens at the desk, the field report is the authority. Nothing was lost:
   * the official quote is still on fz.test's evidence, and what the user is
   * actually told now lives in a note there, with the screenshot as its
   * built-in recovery.
   *
   * ⭐ THE GLASSES were never a document, and that one was my modelling error.
   * The readiness report was asking a man to confirm that his spectacles were
   * "in your possession and valid". They are a thing to remember on the day, so
   * they are now a checklist line on fz.test — which is what `checklist` is for.
   *
   * ⚠️ Both were found by Chaya reading the readiness report on the day it
   * shipped. The report did not create either problem; it made two old ones
   * legible for the first time by printing every required document in one list.
   */
];
