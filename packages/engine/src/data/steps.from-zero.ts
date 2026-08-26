import type { StepInput } from '../domain';
import type { Condition } from '../condition';
import { servicePage, official, fieldReport, inferred, notChecked, LAST_VERIFIED_LATE } from './sources';

/**
 * ============================================================================
 * מסלול מאפס — issuing a licence from scratch
 * ============================================================================
 *
 * Source: גיליון 04_מסלול_מאפס, assembled per גיליונות F4 and F5.
 *
 * ⭐ F4 and F5 are ONE list, not two. The steps are identical; what changes is
 * the channel. גיליון F0: "אותו שלב, ערוץ אחר." Where a step genuinely splits
 * (the היתר, the ליווי declaration) there are two entries with opposite
 * conditions, and that is the exception, not the shape of the route.
 *
 * ⚠️ This is the route with the strongest field evidence in the whole research
 * (one complete documented case, א/2, 2025-2026) and the most gaps that appear
 * in no official source anywhere.
 */

const NO_TEUDAT_ZEHUT: Condition = { field: 'has_teudat_zehut', op: 'eq', value: false };
const HAS_TEUDAT_ZEHUT: Condition = { field: 'has_teudat_zehut', op: 'eq', value: true };
const EVERYONE: Condition = { always: true };

export const FROM_ZERO_STEPS: StepInput[] = [
  {
    id: 'fz.english_name',
    track: 'from_zero',
    title: { he: "עדכון השם באנגלית ברשות האוכלוסין", en: 'Update your name in English' },
    action: {
      he: "ודא שהשם שלך רשום באנגלית ברשות האוכלוסין וההגירה, בכתיב זהה לדרכון.",
      en: 'Make sure your name is registered in English at the Population Authority, spelled as in your passport.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 1,
    act_when: 'start_now',
    channel: 'population_authority',
    authority: "רשות האוכלוסין וההגירה",
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "נדרש שהשם יהיה מעודכן באנגלית ברשות האוכלוסין",
        "יש לוודא כי שמם של מגישי הבקשה מעודכן בשפה האנגלית ברשות האוכלוסין וההגירה.",
      ),
      // 📏 כלל הודאות: the requirement is 🟢, the reason we act on is 🟡, so the step is 🟡.
      inferred(
        "הכתיב חייב להיות זהה לדרכון — הדף דורש עדכון, לא התאמה",
        'גיליון 03 שורה 3 · גיליון 05 שורה 13',
      ),
    ],
  },

  {
    id: 'fz.doc_89',
    track: 'from_zero',
    title: { he: "הוצאת מספר מזהה 89 (\"הטופס הלבן\")", en: 'Get your 89 identity number (the "white form")' },
    action: {
      he: "הגע למשרד הרישוי עם דרכון מקורי ואשרת שהייה בתוקף. תקבל מספר מזהה שמתחיל ב-89, מודפס על דף A4.",
      en: 'Go to a licensing office with your original passport and a valid visa. You get an identity number starting with 89, printed on an A4 sheet.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    // ⚠️ First. Not because it is urgent, but because the green form's identity
    // field expects this number. Doing it later costs two wasted visits.
    sequence_position: 2,
    act_when: 'start_now',
    channel: 'licensing_office',
    authority: "משרד הרישוי",
    requires_appointment: false,
    requires_documents: ['doc.passport', 'doc.visa'],
    fallback: {
      he: "לך בלי תור. אם דוחים אותך — קבע תור באותו רגע, במקום.",
      en: 'Go without an appointment. If they turn you away, book one there and then.',
    },
    checklist: [
      { he: "האשרה בתוקף?", en: 'Is your visa currently valid?' },
      { he: "הדרכון מקורי, לא צילום?", en: 'Is the passport the original, not a copy?' },
    ],
    evidence: [
      servicePage(
        "הוצאת רישיון נהיגה לעובד זר",
        "משרד הרישוי מנפיק מספר זיהוי המתחיל ב-89",
        "במשרד הרישוי יונפק מספר זיהוי פיקטיבי המתחיל בספרות 89.",
      ),
      // The page says "עובד זר". The reality is wider, and that is a field finding.
      fieldReport(
        "חל על כל מי שאין לו תעודת זהות, לא רק על עובד זר — בעלת א/2 קיבלה מספר 89 בפועל",
        { varies_by: ['branch'] },
      ),
      fieldReport("להנפקה הראשונה אין צורך בתור מראש. כל ביקור אחר מחייב תור", {
        varies_by: ['branch'],
      }),
      fieldReport(
        "השלב חייב לבוא לפני הטופס המקוון ולפני בדיקת הראייה — שדה הזיהוי בטופס מקבל את מספר ה-89",
        { generalizability: 'corroborated' },
      ),
      // ⭐ the founder, 25.8. The general principle behind the step, which the gov.il
      // page never states: every Israeli driver needs an identifying number.
      // No teudat zehut means an 89, and that is true on BOTH tracks.
      fieldReport(
        "כל נהג בישראל חייב מספר מזהה. מי שאין לו תעודת זהות מקבל מספר 89 — וזה נכון בשני המסלולים, המרה ומאפס, והוא התחנה הראשונה",
        { generalizability: 'pattern', last_verified_at: LAST_VERIFIED_LATE },
      ),
    ],
  },

  {
    id: 'fz.online_form',
    track: 'from_zero',
    title: { he: "מילוי בקשה מקוונת (\"הטופס הירוק\")", en: 'Fill in the online application' },
    action: {
      he: "מלא את הבקשה להוצאת רישיון נהיגה: פרטים אישיים, בחירת דרגות, והצהרה רפואית.",
      en: 'Complete the licence application: personal details, the grades you want, and the medical declaration.',
    },
    applies_when: EVERYONE,
    sequence_position: 3,
    // ⚠️ The ordering constraint that cost two visits in the documented case.
    must_come_after: ['fz.doc_89'],
    channel: 'online',
    authority: "משרד התחבורה",
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "ההצהרה הרפואית תקפה חמש שנים",
        "ההצהרה הרפואית תקפה ל5 שנים.",
      ),
      // The nickname is not on gov.il, but it is what everyone actually calls it,
      // at the counter and in the community. Worth using, because a user
      // searching for "טופס ירוק" is searching for the right thing.
      fieldReport(
        "\"טופס ירוק\" הוא הכינוי שבשימוש בכל מקום — במשרד הרישוי ובקהילה — אף שאינו מונח רשמי באתר",
        { generalizability: 'pattern', last_verified_at: LAST_VERIFIED_LATE },
      ),
    ],
  },

  {
    id: 'fz.photo_and_eye',
    track: 'from_zero',
    title: { he: "תחנת צילום ובדיקת ראייה", en: 'Photo station and eye test' },
    action: {
      he: "הגע לתחנת צילום עם תעודה מזהה. הצילום חינם; בדיקת הראייה בתשלום ומתבצעת באותו מקום.",
      en: 'Go to a photo station with photo ID. The photo is free; the eye test is paid and happens there.',
    },
    applies_when: EVERYONE,
    sequence_position: 4,
    must_come_after: ['fz.doc_89'],
    channel: 'photo_station',
    requires_documents: ['doc.passport', 'doc.form_89'],
    checklist: [
      {
        he: "הטופס הלבן (89) פיזית איתך — ולא רק הטופס הירוק שמילאת?",
        en: 'Do you physically have the white form (89), not just the green form you filled in?',
      },
    ],
    cost: {
      amount_ils: 50,
      note: { he: "הצילום חינם. התשלום הוא על בדיקת הראייה.", en: 'The photo is free. The payment is for the eye test.' },
      evidence: [
        official(
          'דף "תחנות צילום לרישיון נהיגה", משרד התחבורה',
          "הצילום להנפקת רישיון חדש אינו כרוך בתשלום",
          "לא נדרש לבצע תשלום עבור צילום להנפקת רישיון נהיגה חדש או חידוש רישיון",
          'https://www.gov.il/he/service/drivers_license_photo_stations',
        ),
        fieldReport("בדיקת הראייה עלתה 50 ₪", { reports: 2, generalizability: 'corroborated' }),
      ],
    },
    evidence: [
      official(
        'דף "תחנות צילום לרישיון נהיגה", משרד התחבורה',
        "מסמך מזהה מתקבל: תעודת זהות, דרכון או רישיון נהיגה",
        "תעודה מזהה בתוקף: תעודת זהות, דרכון או רישיון נהיגה.",
        'https://www.gov.il/he/service/drivers_license_photo_stations',
      ),
      fieldReport("בלי הטופס הלבן (89) בדיקת הראייה אינה מתבצעת", { varies_by: ['branch'] }),
    ],
  },

  {
    id: 'fz.theory',
    track: 'from_zero',
    title: { he: "מבחן תיאוריה", en: 'Theory test' },
    action: {
      he: "היבחן במבחן העיוני: 30 שאלות, 40 דקות, עוברים ב-26 תשובות נכונות. תוקף התוצאה חמש שנים.",
      en: '30 questions, 40 minutes, 26 correct to pass. The result is valid for five years.',
    },
    applies_when: EVERYONE,
    sequence_position: 5,
    channel: 'test_center',
    checklist: [
      {
        he: "צריך להיבחן בעל-פה ולא במחשב? התקשר ל-*5678 לברר באילו שפות זה אפשרי — אנחנו לא יודעים.",
        en: 'Need to take it orally rather than on a computer? Call *5678 to ask which languages that is offered in. We do not know.',
      },
    ],
    evidence: [
      servicePage(
        "המבחן העיוני (תאוריה)",
        "מבנה המבחן ותוקפו",
        "משך המבחן הוא 40 דקות. המבחן מתבצע על מחשב. המבחן מורכב מ-30 שאלות. נבחנים שהשיבו נכון על 26 שאלות מתוך 30, עוברים את המבחן העיוני בהצלחה. תוקף המבחן העיוני הוא ל-5 שנים.",
      ),
      inferred(
        "המבחן הממוחשב קיים בשבע שפות: עברית, ערבית, רוסית, אמהרית, אנגלית, צרפתית וספרדית",
        'כל-זכות, "מבחן נהיגה עיוני (תיאוריה)", עודכן 9.7.2026',
      ),
      // ⚠️ Resolved by the founder 2026-08-25, and it overturns a row in the research workbook.
      //
      // גיליון 09 row 16 asserts "מבחן בשמע — עברית וערבית בלבד" and marks it
      // 🟢 מאומת. גיליון 04 row 10, on the same claim, says the opposite:
      // "נבדק פעמיים, לא אומת... אין להזין אותו למערכת כעובדה."
      //
      // גיליון 04 is right and גיליון 09 is wrong. No source was found in EITHER
      // direction, so the honest answer is that we do not know, and it may well
      // be all seven. That matters: a wrong "Hebrew and Arabic only" would tell
      // someone who cannot read that a route is closed to him when it may not be.
      // Rendering unknown as no is exactly principle 8.
      notChecked(
        "באילו שפות מוצע המבחן בעל-פה — ייתכן שבכל שבע השפות. נבדק פעמיים ולא אותר מקור לשום כיוון. לבירור מול *5678 או מרכז בחינות",
      ),
    ],
  },

  {
    id: 'fz.lessons',
    track: 'from_zero',
    title: { he: "שיעורי נהיגה", en: 'Driving lessons' },
    action: {
      he: "לרישיון רכב פרטי נדרשים 28 שיעורים לפחות. זו מכסת מינימום, לא הערכה.",
      en: 'A private car licence requires at least 28 lessons. That is a minimum, not an estimate.',
    },
    applies_when: EVERYONE,
    sequence_position: 6,
    channel: 'driving_school',
    evidence: [
      servicePage(
        "לימוד נהיגה מעשי",
        "מכסת מינימום של 28 שיעורים, ולרוב אינה מספיקה",
        "לדוגמה: לרישיון רכב פרטי נדרש לבצע 28 שיעורים מינימום. לרוב התלמידים מספר השיעורים המינימלי אינו מספיק.",
      ),
    ],
  },

  {
    id: 'fz.internal_test',
    track: 'from_zero',
    title: { he: "מבחן פנימי ותשלום אגרת בחינה", en: 'Internal test and exam fee' },
    action: {
      he: "שלם את אגרת הבחינה מקוון, ואז גש למבחן הפנימי מטעם בית הספר.",
      en: 'Pay the exam fee online, then take the driving school’s internal test.',
    },
    applies_when: EVERYONE,
    sequence_position: 7,
    channel: 'driving_school',
    evidence: [
      servicePage(
        "לימוד נהיגה מעשי",
        "תשלום אגרת בחינה נדרש לפני המבחן הפנימי",
        "לפני ביצוע מבחן פנימי יש לבצע תשלום אגרת בחינה.",
      ),
      // Worth stating plainly: this one is NOT a barrier, and saying so prevents
      // a user assuming every payment will be.
      fieldReport("אגרת הבחינה משולמת מקוון ועובדת גם עם מספר 89 — אין כאן חסם"),
    ],
  },

  {
    id: 'fz.book_permit_appointment',
    track: 'from_zero',
    title: { he: "⭐ קבע תור להוצאת ההיתר — עוד לפני הטסט", en: '⭐ Book the permit appointment BEFORE your test' },
    action: {
      he: "קבע עכשיו תור למשרד הרישוי להוצאת היתר הנהיגה, לתאריך שאחרי הטסט. מי שממתין לתוצאה ורק אז מזמן תור, ממתין כשבועיים.",
      en: 'Book a licensing office appointment now, for a date after your test. Waiting for the result first means about two more weeks.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 8,
    // ⭐ Sits at position 8 but must happen before step 9. This is exactly why
    // act_when exists separately from sequence_position.
    act_when: { before: 'fz.test' },
    channel: 'licensing_office',
    authority: "משרד הרישוי",
    requires_appointment: true,
    evidence: [
      fieldReport(
        "יש לקבוע את התור לפני הטסט, לתאריך שאחריו. המתנה לתוצאה עולה כשבועיים",
        { last_verified_at: LAST_VERIFIED_LATE },
      ),
      // The mechanism behind the advice is officially quoted, which is what
      // makes this the strongest 🔵 in the research.
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "תקופת הליווי נספרת מיום הוצאת הרישיון, לא מיום הטסט",
        "מתחת לגיל 24 - הרישיון יישלח רק לאחר הצהרת נהג חדש על סיום תכנית הליווי, בתנאי שעברה חצי שנה מיום הוצאת רישיון הנהיגה.",
      ),
    ],
  },

  {
    id: 'fz.test',
    track: 'from_zero',
    title: { he: "מבחן מעשי (טסט)", en: 'Practical driving test' },
    action: {
      he: "הגע לטסט עם תעודה מזהה, אישור תשלום האגרה, ומשקפיים אם אתה מרכיב.",
      en: 'Bring photo ID, proof of fee payment, and glasses or lenses if you wear them.',
    },
    applies_when: EVERYONE,
    sequence_position: 9,
    channel: 'test_center',
    requires_documents: ['doc.passport', 'doc.form_89'],
    checklist: [
      {
        he: "⚠️ מספר הדרכון במסמך ה-89 זהה למספר בדרכון שבידך? אי-התאמה מונעת את קיום הטסט, והוא נרשם ככישלון.",
        en: '⚠️ Does the passport number on your 89 document match the passport in your hand? A mismatch stops the test from happening, and it is recorded as a failure.',
      },
      { he: "קבעת כבר תור להוצאת ההיתר?", en: 'Have you already booked the permit appointment?' },
    ],
    cost: {
      amount_ils: 165,
      max_ils: 394,
      note: {
        he: "אגרת הטסט, ובנפרד העמדת רכב מטעם המורה.",
        en: 'The government test fee, plus the instructor’s charge for providing the car.',
      },
      evidence: [
        inferred("אגרת טסט 165 ₪ והעמדת רכב עד 229 ₪", 'כל-זכות, "מבחן נהיגה מעשי (טסט) לרכב פרטי", עודכן 14.4.2026'),
      ],
    },
    evidence: [
      servicePage(
        "מה להביא למבחן המעשי (טסט)",
        "רשימת המסמכים לטסט",
        "תעודת זהות, דרכון או רישיון נהיגה · אישור על תשלום האגרה · משקפיים או עדשות מגע, אם יש צורך.",
      ),
      // ⚠️ Not in the official list. It comes from the field, and it is the
      // single most expensive trap in the route.
      fieldReport(
        "אי-התאמה בין מספר הדרכון שבמסמך ה-89 לדרכון שבידך מונעת את קיום הטסט, והוא נרשם ככישלון",
      ),
    ],
  },

  {
    id: 'fz.permit_online',
    track: 'from_zero',
    title: { he: "קבלת היתר נהיגה — מקוון", en: 'Receive your driving permit online' },
    action: {
      he: "הרישיון הזמני מנייר יישלח אליך מקוון תוך 72 שעות מסיום הטסט, אם אין הגבלות.",
      en: 'The temporary paper licence is sent to you online within 72 hours of passing, if there are no restrictions.',
    },
    applies_when: HAS_TEUDAT_ZEHUT,
    sequence_position: 10,
    channel: 'online',
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "הרישיון הזמני נשלח מקוון תוך 72 שעות",
        "הנבחנים יקבלו את רישיון הנהיגה הזמני מנייר (אם אין הגבלות), לא יאוחר מ-72 שעות.",
      ),
    ],
  },

  {
    id: 'fz.permit_in_person',
    track: 'from_zero',
    title: { he: "קבלת היתר נהיגה — בהגעה פיזית", en: 'Collect your driving permit in person' },
    action: {
      he: "ההיתר אינו נשלח מקוון. הגע למשרד הרישוי בתור שקבעת, עם כל המסמכים. ההיתר נמסר במקום, על נייר.",
      en: 'The permit is not sent online. Go to the licensing office on the appointment you booked, with all your documents. It is handed over there, on paper.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 10,
    channel: 'licensing_office',
    requires_appointment: true,
    requires_documents: ['doc.passport', 'doc.form_89'],
    evidence: [
      fieldReport(
        "מי שאין לו תעודת זהות אינו מקבל את הרישיון הזמני מקוון — נדרשים תור והגעה פיזית, וההיתר נמסר במקום",
      ),
      // ⭐ Upgraded 2026-08-25. The office STATED the cause; it is no longer
      // inferred from the fact that the online route did not work for her.
      fieldReport(
        "במשרד הרישוי אמרו במפורש שהסיבה שההיתר לא נשלח מקוון היא שאין לה תעודת זהות",
        { generalizability: 'corroborated', last_verified_at: LAST_VERIFIED_LATE },
      ),
      // ⚠️ The page does not merely omit this. It creates the opposite expectation,
      // which is how someone ends up waiting for a document that will never arrive.
      unresolvedNote(),
    ],
  },

  {
    id: 'fz.permit_fee',
    track: 'from_zero',
    title: { he: "תשלום אגרת ההיתר בסניף דואר", en: 'Pay the permit fee at a post office' },
    action: {
      he: "ההיתר אינו בתוקף עד שתשלם את האגרה בסניף דואר. לא ניתן לשלם מקוון.",
      en: 'The permit is not valid until you pay the fee at a post office. It cannot be paid online.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 11,
    must_come_after: ['fz.permit_in_person'],
    channel: 'post_office',
    requires_appointment: false,
    cost: {
      amount_ils: 15,
      max_ils: 20,
      note: { he: "משולם בסניף דואר. לא ניתן לשלם מקוון.", en: 'Paid at a post office. Cannot be paid online.' },
      evidence: [
        fieldReport("האגרה עמדה על כ-15-20 ₪, שולמה בסניף דואר", {
          last_verified_at: LAST_VERIFIED_LATE,
        }),
      ],
    },
    evidence: [
      fieldReport("ההיתר אינו בתוקף עד תשלום אגרה בסניף דואר, ולא ניתן לשלם מקוון"),
      // The correction from גיליון 14 item 9: a normal post office queue, not a
      // dedicated service. Still an extra physical visit, but do not overstate it.
      fieldReport("התור בדואר הוא תור רגיל לסניף ולא הזמנה לשירות ייעודי", {
        last_verified_at: LAST_VERIFIED_LATE,
      }),
    ],
  },

  {
    id: 'fz.accompanied_driving',
    track: 'from_zero',
    title: { he: "שישה חודשי נהיגה עם מלווה", en: 'Six months of accompanied driving' },
    action: {
      he: "מתחת לגיל 24 חלה תקופת ליווי של חצי שנה. ⚠️ היא נספרת מיום הוצאת ההיתר, לא מיום הטסט.",
      en: 'Under 24 you must drive accompanied for six months. ⚠️ It counts from the day the permit issues, not from the test.',
    },
    applies_when: { field: 'age_years', op: 'lt', value: 24 },
    sequence_position: 12,
    channel: 'unknown',
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "ליווי של חצי שנה מיום הוצאת הרישיון, מתחת לגיל 24, ובתנאי שלא נעברה עבירה",
        "מתחת לגיל 24 - הרישיון יישלח רק לאחר הצהרת נהג חדש על סיום תכנית הליווי, בתנאי שעברה חצי שנה מיום הוצאת רישיון הנהיגה ובתנאי שלא נעברה עבירה.",
      ),
    ],
  },

  {
    id: 'fz.completion_online',
    track: 'from_zero',
    title: { he: "הצהרת סיום ליווי", en: 'Declare the accompaniment period complete' },
    action: { he: "הגש את הצהרת נהג חדש על סיום תכנית הליווי.", en: 'Submit the new-driver declaration that the accompaniment period is over.' },
    applies_when: HAS_TEUDAT_ZEHUT,
    sequence_position: 13,
    channel: 'online',
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "הרישיון הקבוע נשלח רק אחרי הצהרת סיום הליווי",
        "הרישיון יישלח רק לאחר הצהרת נהג חדש על סיום תכנית הליווי.",
      ),
      // ⭐ Confirmed by the founder 25.8: it genuinely is online for teudat zehut
      // holders. That is what makes this a true channel split rather than a
      // step that happens to be physical for everyone.
      fieldReport("לבעלי תעודת זהות ההצהרה אכן מוגשת מקוון", {
        generalizability: 'corroborated',
        last_verified_at: LAST_VERIFIED_LATE,
      }),
    ],
  },

  {
    id: 'fz.completion_in_person',
    track: 'from_zero',
    title: { he: "הצהרת סיום ליווי — בהגעה פיזית", en: 'Declare completion in person' },
    action: {
      he: "ההצהרה אינה מקוונת. קבע תור, הגע למשרד הרישוי עם כל המסמכים, והפקיד מצהיר במערכת במקומך.",
      en: 'The declaration is not online. Book an appointment, bring all your documents, and the clerk files it in the system for you.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 13,
    channel: 'licensing_office',
    requires_appointment: true,
    evidence: [
      fieldReport(
        "מי שאין לו תעודת זהות אינו יכול להצהיר מקוון — נדרשים תור והגעה פיזית, והפקיד מצהיר במערכת",
      ),
      fieldReport("הפקיד ידע בדיוק מה לעשות — זהו מסלול פנימי מתועד ולא אלתור", {
        generalizability: 'corroborated',
      }),
    ],
  },

  {
    id: 'fz.plastic_fee',
    track: 'from_zero',
    title: { he: "תשלום אגרת הרישיון הקבוע בסניף דואר", en: 'Pay the permanent licence fee at a post office' },
    action: { he: "שלם את אגרת כרטיס הפלסטיק בסניף דואר.", en: 'Pay the plastic card fee at a post office.' },
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 14,
    channel: 'post_office',
    cost: {
      amount_ils: 20,
      max_ils: 30,
      note: { he: "משולם בסניף דואר.", en: 'Paid at a post office.' },
      evidence: [
        // ⚠️ גיליון 14 item 10 had voided the old ~30 ₪ figure as a mix-up with
        // the 23 ₪ duplicate fee. The founder re-confirmed 25.8 that the first issue
        // was itself in the 20-30 ₪ range, so the range is back — as her report,
        // not as the earlier confusion.
        fieldReport("אגרת ההנפקה הראשונה עמדה על כ-20-30 ₪, שולמה בסניף דואר", {
          last_verified_at: LAST_VERIFIED_LATE,
        }),
      ],
    },
    evidence: [fieldReport("אגרת כרטיס הפלסטיק משולמת בסניף דואר")],
  },

  {
    id: 'fz.receive_card',
    track: 'from_zero',
    title: { he: "קבלת רישיון הנהיגה הקבוע", en: 'Receive the permanent licence' },
    action: {
      he: "כרטיס הפלסטיק נשלח בדואר לכתובת המעודכנת ברשות האוכלוסין.",
      en: 'The plastic card is posted to the address registered with the Population Authority.',
    },
    applies_when: EVERYONE,
    sequence_position: 15,
    channel: 'mail',
    checklist: [
      {
        he: "הכתובת שלך מעודכנת ברשות האוכלוסין? אליה יישלח הרישיון.",
        en: 'Is your address up to date at the Population Authority? That is where it goes.',
      },
    ],
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "הרישיון הקבוע נשלח לכתובת המעודכנת ברשות האוכלוסין",
        "רישיון נהיגה קבוע (פלסטיק) יישלח לכתובת המעודכנת ברשות האוכלוסין.",
      ),
      // "About a month" now has a source: she was told it. Still not official,
      // and the same report records that it did not arrive at all.
      fieldReport("נאמר לה שהכרטיס אמור להגיע תוך כחודש", {
        last_verified_at: LAST_VERIFIED_LATE,
      }),
      fieldReport("בדיווח: שנה מאז הטסט והכרטיס לא הגיע, למרות שהכתובת הייתה רשומה ונכונה"),
    ],
  },

  {
    id: 'fz.duplicate',
    track: 'from_zero',
    title: { he: "הכרטיס לא הגיע — מסלול שחזור", en: 'The card never arrived: how to get a replacement' },
    action: {
      he:
        "קבע תור למשרד הרישוי ובקש הוצאת כפל רישיון. שלם 23 ₪ בסניף דואר.\n\n" +
        "תוך 48 שעות מהתשלום — היכנס ל-fastdl.co.il ובחר איך לקבל את הרישיון:\n" +
        "· איסוף עצמי בדפוס בארי — חינם, ואינו דורש כתובת רשומה\n" +
        "· שליח עד הבית — בתשלום\n" +
        "· דואר לכתובת\n" +
        "· וגם: נתב\"ג · דואר רשום · מעברי גבול",
      en:
        'Book a licensing office appointment and ask for a duplicate licence. Pay 23 ILS at a post office.\n\n' +
        'Within 48 hours of paying, go to fastdl.co.il and choose how to receive the licence:\n' +
        '· Collect it yourself at Defus Bari — free, no registered address needed\n' +
        '· Courier to your door — paid\n' +
        '· Post to an address\n' +
        '· Also: Ben Gurion airport · registered post · border crossings',
    },
    applies_when: EVERYONE,
    sequence_position: 16,
    must_come_after: ['fz.receive_card'],
    channel: 'licensing_office',
    requires_appointment: true,
    fallback: {
      he: "אין לך כתובת רשומה? בחר איסוף עצמי בדפוס בארי — חינם, ואינו תלוי בכתובת.",
      en: 'No registered address? Choose self-collection at Defus Bari. It is free and does not depend on an address.',
    },
    cost: {
      amount_ils: 23,
      note: { he: "ייתכן תשלום נוסף לפי אופן המשלוח שתבחר.", en: 'There may be an extra charge depending on the delivery method you choose.' },
      evidence: [fieldReport("אגרת הפקת כפל רישיון 23 ₪, משולמת בסניף דואר", { last_verified_at: LAST_VERIFIED_LATE })],
    },
    evidence: [
      official(
        'דף "הוצאת העתק רישיון נהיגה", משרד התחבורה',
        "השירות קיים רשמית, וחלון שינוי אופן המסירה מתועד",
        "ביום שאחרי ביצוע התשלום ועד 2 ימי עסקים, ניתן לשנות את אופן קבלת הרישיון ואת יעד המסירה.",
        'https://www.gov.il/he/service/duplicate_drivers_license_in_case_of_loss',
        LAST_VERIFIED_LATE,
      ),
      official(
        'אתר דפוס בארי (fastdl.co.il), הקבלן המפיק עבור משרד התחבורה',
        "אפשרויות המסירה, כולל איסוף עצמי ללא תשלום",
        "איסוף בדפוס בארי · נתב\"ג · דואר רגיל · שליח עד הבית · דואר רשום · מעברי גבול",
        'https://fastdl.co.il/',
        LAST_VERIFIED_LATE,
      ),
      fieldReport("המסלול נמסר על ידי מנהלת במוקד *4515 ופקידה במשרד הרישוי", {
        last_verified_at: LAST_VERIFIED_LATE,
      }),
      // ⚠️ Precise, because the distinction matters: the manager said not to miss
      // the window. She did not say what happens if you do. An earlier draft had guessed
      // "probably reverts to ordinary post" earlier and removed it — this
      // records that the guess was his, not hers.
      notChecked(
        "מה קורה למי שמפספס את חלון 48 השעות — לא אותר מקור. ההערכה היא שהרישיון יישלח בדואר",
      ),
    ],
  },
];

/**
 * ⚠️ The gov.il page describes the 72-hour online permit in general terms with
 * no exception noted. For someone without a teudat zehut that is not merely a
 * silence — it sets the opposite expectation, and the documented consequence was
 * waiting weeks for a document that was never going to arrive.
 *
 * Open question 22 decides whether this is a nationwide system limit or branch
 * discretion, and until it is answered the wording stays probabilistic.
 */
function unresolvedNote() {
  return notChecked(
    "האם החסימה מהמסלול המקוון היא מגבלת מערכת ארצית או תלוית סניף — שאלה פתוחה 22",
  );
}
