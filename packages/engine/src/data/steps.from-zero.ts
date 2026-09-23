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
  /**
   * ⭐ DELETED 23.9 (Chaya), same as cv.english_name on the conversion road:
   * "update your name in English" was a duplicate of `cc.english_name_match`,
   * which already guards `fz.online_form`. It is a fact to check, not a task to
   * finish, and printing it as step 1 made a person who is already registered
   * correctly think he had work to do. Position 1 is deliberately vacant.
   */

  {
    id: 'fz.doc_89',
    track: 'from_zero',
    produces_document: 'doc.form_89',
    title: { he: "הוצאת מספר מזהה 89 (\"הטופס הלבן\")", en: 'Get your 89 identity number (the "white form")' },
    action: {
      he:
        "הגע למשרד הרישוי עם דרכון מקורי ואשרת שהייה בתוקף. תקבל דף A4 מודפס עם מספר שמתחיל ב-89.\n\n" +
        "⭐ הדף הזה הוא תעודת הזיהוי שלך לכל מה שקשור לרישיון. קח אותו איתך לכל תור במשרד הרישוי, לתחנת הצילום ולטסט.",
      en: 'Go to a licensing office with your original passport and a valid visa. You get an identity number starting with 89, printed on an A4 sheet.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    // ⚠️ First in ORDER, and that is all. `must_come_after` on the later steps
    // already carries that; it is not a long-lead item.
    //
    // It used to be marked start_now, which rendered as "begin today, it takes
    // time" — false for a single walk-in visit. Chaya, 27.8: "it literally takes
    // one visit." start_now means "months, and someone else controls it", which
    // is true of the רקורד and of nothing else here.
    sequence_position: 2,
    channel: 'licensing_office',
    authority: "משרד הרישוי",
    requires_appointment: false,
    requires_documents: ['doc.passport', 'doc.visa'],
    fallback: {
      he: "לך בלי תור. אם דוחים אותך — קבע תור באותו רגע, במקום.",
      en: 'Go without an appointment. If they turn you away, book one there and then.',
    },
    // ⚠️ "האשרה בתוקף?" was here and is gone: cc.visa_valid already asks it
    // before this step. Saying the same thing twice is what made the screen noisy.
    checklist: [{ he: "הדרכון מקורי, לא צילום?", en: 'Is the passport the original, not a copy?' }],
    links: [{ label: { he: "זימון תור למשרד הרישוי", en: 'Book a licensing office appointment' }, url: 'https://www.gov.il/he/Departments/General/govisit' }],
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
      // ⭐ Chaya, 25.8. The general principle behind the step, which the gov.il
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
      he: "מלא את הבקשה להוצאת רישיון נהיגה: פרטים אישיים, בחירת דרגות, והצהרה רפואית. המילוי ללא תשלום.",
      en: 'Complete the licence application: personal details, the grades you want, and the medical declaration. Filling it in is free.',
    },
    applies_when: EVERYONE,
    sequence_position: 3,
    // ⚠️ The ordering constraint that cost two visits in the documented case.
    must_come_after: ['fz.doc_89'],
    channel: 'online',
    authority: "משרד התחבורה",
    links: [{ label: { he: "טופס הבקשה", en: 'The application form' }, url: 'https://www.gov.il/he/service/apply_for_new_driver_drivers_license' }],
    // ⚠️ Only for someone who holds an 89. Telling a citizen that "the sheet you
    // carry is the white form" is meaningless to him and actively confusing.
    notes: [
      {
        he: "הטופס מקוון בלבד — אין ממנו דף להביא. הדף שאתה נושא הוא הטופס הלבן (89).",
        en: 'The form is online only — there is no printout to carry. The sheet you carry is the white form (89).',
        when: NO_TEUDAT_ZEHUT,
      },
    ],
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "ההצהרה הרפואית תקפה חמש שנים",
        "ההצהרה הרפואית תקפה ל5 שנים.",
      ),
      // The nickname lives in the TITLE, so someone searching for it lands on the
      // right step. It does not need a line of its own arguing about terminology.
      fieldReport("\"טופס ירוק\" הוא הכינוי שבשימוש במשרד הרישוי ובקהילה", {
        generalizability: 'pattern',
        last_verified_at: LAST_VERIFIED_LATE,
      }),
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
    // Generic ID for everyone; the passport-with-visa and the 89 only for those
    // they apply to. The engine filters each against its own applies_when.
    requires_documents: ['doc.identity', 'doc.passport', 'doc.form_89'],
    checklist: [
      {
        // The green-form clarification lives on the green-form step and nowhere
        // else — repeating it at every stop is noise, not emphasis.
        he: "הטופס הלבן (89) איתך?",
        en: 'Do you have the white form (89) with you?',
        when: NO_TEUDAT_ZEHUT,
      },
    ],
    links: [{ label: { he: "תחנות צילום", en: 'Photo stations' }, url: 'https://www.gov.il/he/service/drivers_license_photo_stations' }],
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
    // ⚠️ ordering_constraint, added 22.9 with Chaya. The theory test is booked against the application and the eye test; there
    // is nothing to sit an exam against until both of them exist.
    must_come_after: ['fz.online_form', 'fz.photo_and_eye'],
    channel: 'test_center',
    links: [{ label: { he: "הרשמה למבחן תיאוריה", en: 'Register for the theory test' }, url: 'https://www.theorytest.org.il/' }],
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
      // ⚠️ Resolved by Chaya 2026-08-25, and it overturns a row in her own workbook.
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
    // ⚠️ ordering_constraint, added 22.9 with Chaya. ⭐ Chaya, 22.9: lessons can start BEFORE the theory is passed. They need
    // the green form and the eye test and nothing else. The obvious-looking
    // rule "no lessons until theory" is WRONG and would have blocked a person
    // who is entitled to be out driving.
    must_come_after: ['fz.online_form', 'fz.photo_and_eye'],
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
    // ⚠️ ordering_constraint, added 22.9 with Chaya. The school's own test is the end of the lessons, not a thing beside them.
    must_come_after: ['fz.lessons'],
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
      he:
        "קבע תור למשרד הרישוי להוצאת ההיתר כשבועיים מראש, לתאריך שאחרי הטסט.\n\n" +
        "אם עברת — התור כבר מחכה. אם לא — מבטלים אותו. מי שממתין לתוצאה ורק אז מזמן תור, ממתין כשבועיים נוספים.",
      en:
        'Book the licensing office appointment about two weeks ahead, for a date after your test.\n\n' +
        'If you pass, it is already waiting. If you do not, you cancel it. Booking only after the result costs about two more weeks.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 8,
    // ⭐ Sits at position 8 but must happen before step 9. This is exactly why
    // act_when exists separately from sequence_position.
    act_when: { before: 'fz.test' },
    // ⚠️ Chaya, 22.9: this said licensing_office, and it is wrong. The channel
    // is where the STEP is done, not where the appointment it books is for.
    // Booking is online (the link below is the gov.il booking page); the
    // physical visit is fz.permit_in_person, which is a separate step and
    // correctly marked. Invisible until the place went onto every row, which
    // is the argument for putting it there.
    channel: 'online',
    authority: "משרד הרישוי",
    requires_appointment: true,
    links: [{ label: { he: "זימון תור", en: 'Book an appointment' }, url: 'https://www.gov.il/he/Departments/General/govisit' }],
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
      // ⚠️ NAMES NO DOCUMENT, and that is not vagueness. A citizen on this
      // route has no 89 and never will, so spelling one out here would tell him
      // to bring a document he was correctly never told to obtain — the exact
      // bug Chaya found on 27.8. The engine already filters `requires_documents`
      // per person, so the list is built for the reader instead of guessed here.
      he: "הגע לטסט עם המסמכים שברשימה למטה.",
      en: 'Come to the test with the documents listed below.',
    },
    applies_when: EVERYONE,
    sequence_position: 9,
    // ⚠️ ordering_constraint, added 22.9 with Chaya. ⭐ The practical test is where the theory DOES bind. Until 22.9 nothing
    // stopped this being ticked before a single lesson had been taken.
    must_come_after: ['fz.theory', 'fz.lessons', 'fz.internal_test'],
    channel: 'test_center',
    /**
     * ⚠️ THE FEE RECEIPT AND THE GLASSES WERE BOTH TAKEN OFF THIS LIST ON 31.8,
     * and for two completely different reasons. Chaya, reading the readiness
     * report:
     *
     *   "i did the test and was never asked to show the payment - u do it
     *    online and then your tester sees it and orders the test for u based on
     *    that. and the same with the glasses - just say before the test that
     *    the user shouldn't forget to bring the glasses if he has"
     *
     * ⭐ THE RECEIPT is a stale official requirement. This is her SECOND report
     * on it — on 27.8 she said only "never heard about that", and it stayed
     * because the gov.il list quotes it. This time she gave the mechanism: the
     * fee is paid online and whoever books the test sees it in the system. That
     * explains WHY nobody asks, which is a much stronger thing than not having
     * been asked, and גיליון 13's "מי סמכותי למה" is explicit that for what
     * actually happens at the desk, the field report is the authority. The
     * official quote is not deleted — it stays in the evidence below, and the
     * advice carries its own recovery in the note.
     *
     * ⭐ THE GLASSES were never a document at all, and that was my modelling
     * error, not a stale source. The readiness report was asking a person to
     * confirm that his spectacles were "in his possession and valid", which is
     * close to meaningless. They are a thing to remember on the day, so they
     * are a checklist line — which is exactly what `checklist` is for.
     */
    requires_documents: ['doc.identity', 'doc.passport', 'doc.form_89'],
    // ⚠️ The passport-number check was here AND in cc.passport_number_match,
    // which runs before this step anyway. The copy is gone.
    checklist: [
      {
        he: "קבעת כבר תור להוצאת ההיתר?",
        en: 'Have you already booked the permit appointment?',
        // ⚠️ There IS no appointment for someone with a teudat zehut — his
        // permit arrives online within 72 hours. The whole reason this question
        // exists is the channel difference.
        when: NO_TEUDAT_ZEHUT,
      },
      {
        // ⭐ Chaya, 31.8. A reminder on the day, not a document to verify.
        he: "מרכיבי משקפיים או עדשות מגע — יש להביא אותם לטסט.",
        en: 'If you wear glasses or contact lenses, bring them to the test.',
      },
    ],
    notes: [
      {
        he:
          "אגרת הטסט משולמת מקוון, ומי שקובע לך את הטסט רואה את התשלום במערכת וקובע על סמכו. אין צורך להגיע עם אישור מודפס.\n" +
          "⚠️ הרשימה הרשמית עדיין מזכירה אישור תשלום, ולכן מומלץ לשמור צילום מסך של התשלום.",
        en:
          'The test fee is paid online, and whoever books your test sees the payment in the system and books it on that basis. You do not need to arrive with a printed receipt.\n' +
          '⚠️ The official list still mentions a payment receipt, so keep a screenshot of the payment.',
      },
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
      /**
       * ⚠️ SUPERSEDES the 27.8 report, which said only "never heard about that"
       * and left the receipt on the list. On 31.8 Chaya gave the MECHANISM —
       * the fee is paid online and whoever books the test sees it in the system
       * — which explains why nobody asks and makes the official list stale
       * rather than merely inconsistently enforced.
       *
       * ⬜ One thing deliberately NOT resolved: she wrote "your tester", and it
       * is not settled whether that is the מורה who books the test or the בוחן
       * who conducts it. The note is worded so it does not have to be.
       */
      fieldReport(
        "אגרת הטסט משולמת מקוון ונראית במערכת למי שקובע את הטסט; בפועל לא מתבקש אישור תשלום מודפס בטסט",
        { reports: 2, generalizability: 'corroborated', last_verified_at: '2026-08-31' },
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
    // ⚠️ ordering_constraint, added 22.9 with Chaya. The permit is what passing the test produces.
    must_come_after: ['fz.test'],
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
    // ⚠️ ordering_constraint, added 22.9 with Chaya. The permit is what passing the test produces.
    must_come_after: ['fz.test'],
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
    id: 'fz.new_driver',
    track: 'from_zero',
    title: { he: "מגבלות נהג חדש", en: 'New-driver restrictions' },
    action: {
      he: "אתה \"נהג חדש\" למשך שנתיים מיום קבלת הרישיון. כל עוד אתה נהג חדש, חובה להצמיד שלט \"נהג חדש\" לשוליים התחתונים של השמשה האחורית בכל רכב שאתה נוהג בו — 12X20 ס\"מ, אותיות בגובה 40 מ\"מ, שחור על רקע צהוב מחזיר אור. ⚠️ וכשאתה כבר לא נהג חדש, חובה להוריד אותו.",
      en: 'You are a "new driver" for two years from the day you receive the licence. Throughout, you must fix a "new driver" sign to the lower edge of the rear window of any car you drive — 12x20 cm, 40 mm letters, black on reflective yellow. \u26a0\ufe0f And once you are no longer a new driver, you must take it off.',
    },
    /**
     * ⭐ ONE box, and the lines inside it adjust to the person.
     *
     * Chaya, 27.8: "the questionnaire asked for an age, so the system knows how
     * old a person is and should apply the exact rules for him. That's exactly
     * why my system is unique — it's personal and can avoid more mistakes."
     *
     * So the box shows for everyone (new-driver status and the sign are
     * age-independent), and the ליווי and passenger lines appear only for the
     * ages they bind. Nobody reads a restriction that is not his.
     */
    applies_when: EVERYONE,
    sequence_position: 12,
    // ⚠️ ordering_constraint, added 22.9 with Chaya. New-driver limits begin with the permit. Both routes to it are named; only
    // the one that applies to him is ever in his roadmap, so in practice this
    // reads as an OR.
    must_come_after: ['fz.permit_online', 'fz.permit_in_person'],
    channel: 'unknown',
    notes: [
      {
        // ── under 24: the accompaniment programme ──
        he: "מתחת לגיל 24 — חובת ליווי של שישה חודשים מיום הוצאת ההיתר. ⚠️ מיום ההיתר, לא מיום הטסט. שלושת החודשים הראשונים ליווי מלא ביום ובלילה, ושלושת הבאים בשעות הלילה בלבד (21:00–06:00).",
        en: 'Under 24 — six months of accompanied driving from the day the permit issues. \u26a0\ufe0f From the permit, not from the test. The first three months fully accompanied day and night, the next three at night only (21:00–06:00).',
        when: { field: 'age_years', op: 'lt', value: 24 },
      },
      {
        he: "בסך הכול 50 שעות נהיגה לפחות: 20 בדרך עירונית, 15 בדרך בין-עירונית, ו-15 בשעות הלילה. אין הגבלה על מספר המלווים. אם לא סיימת בתוך שישה חודשים — תקבל היתר נוסף לשישה חודשים עד להשלמה.",
        en: 'Fifty hours of driving at least: 20 urban, 15 interurban, 15 at night. No limit on how many different people accompany you. If you have not finished within six months, you get a further six-month permit until you do.',
        when: { field: 'age_years', op: 'lt', value: 24 },
      },
      {
        // ── under 21: the passenger limit, which outlives the ליווי ──
        he: "⚠️ מתחת לגיל 21 — אסור להסיע יותר משני נוסעים, עד שימלאו לך 21. אם יושב מלווה במושב שלצידך, ההגבלה אינה חלה.",
        en: '\u26a0\ufe0f Under 21 — you may not carry more than two passengers, until you turn 21. If an accompanying driver sits beside you, the restriction does not apply.',
        when: { field: 'age_years', op: 'lt', value: 21 },
      },
      {
        // ── 24 and over: say what does NOT apply, so he is not left wondering ──
        he: "מגיל 24 ומעלה אין חובת ליווי ואין הגבלת נוסעים — אבל שאר תנאי נהג חדש עדיין חלים עליך.",
        en: 'From 24 upwards there is no accompaniment requirement and no passenger limit — but the rest of the new-driver conditions still apply to you.',
        when: { field: 'age_years', op: 'gte', value: 24 },
      },
    ],
    evidence: [
      servicePage(
        "נהג חדש ומלווה",
        "נהג חדש לשנתיים; מתחת ל-24 נקרא \"נהג חדש צעיר\"; מגיל 24 יש פטור מליווי",
        "נהג מוגדר כנהג חדש בשנתיים הראשונות לאחר קבלת רישיון הנהיגה. נהג חדש צעיר הוא נהג חדש, שטרם מלאו לו 24 שנים... נהג חדש שגילו 24 שנים או יותר פטור מליווי.",
      ),
      servicePage(
        "נהג חדש ומלווה",
        "שישה חודשי ליווי מיום ההיתר: שלושה מלאים ושלושה בשעות הלילה בלבד",
        "חובת הליווי תחול לתקופה של שישה חודשים מיום קבלת היתר הנהיגה הראשון, מהם שלושה חודשי ליווי מלא במהלך נהיגה ביום ובלילה, ושלושה חודשי ליווי בשעות הלילה בלבד. שעות הלילה הן השעות שבין 21:00 ל-06:00.",
      ),
      servicePage(
        "נהג חדש ומלווה",
        "מכסת השעות, ריבוי מלווים, והיתר נוסף אם לא הסתיים בזמן",
        "50 שעות לפחות, מהן 20 שעות נהיגה בדרך עירונית, 15 שעות נהיגה בדרך בין עירונית, ו-15 שעות נהיגה בשעות הלילה... אין הגבלה על מספר המלווים לשם ביצוע תכנית הליווי... אם בתום שישה חודשים לא הסתיימה תוכנית הליווי, יינתן לנהג היתר נהיגה לשישה חודשים נוספים עד להשלמתה.",
      ),
      servicePage(
        "נהג חדש ומלווה",
        "הגבלת שני הנוסעים עד גיל 21, ומלווה שמסיר אותה",
        "נהג חדש צעיר, שטרם מלאו לו 21 שנים, לא יורשה להסיע יותר משני נוסעים, אלא אם יושב מלווה במושב שלצידו. נהג חדש, כל עוד רשום ברישיון הנהיגה שלו שהוא נהג חדש, אינו רשאי להסיע יותר משני נוסעים ברכב, אלא לאחר שימלאו לו 21 שנים.",
      ),
      servicePage(
        "נהג חדש ומלווה",
        "חובת השלט, מידותיו ומיקומו — וחובת הסרתו כשאינך עוד נהג חדש",
        "כל נהג המוגדר כנהג חדש חייב לתלות על השמשה האחורית של כלי הרכב בו הוא נוהג שלט המיידע את הנהגים האחרים כי לפניהם נהג חסר ניסיון. ברכב פרטי וברכב מסחרי עד 4 טונות, יש להציג שלט בגודל של 12X20 סנטימטרים. גובה האותיות יהיה 40 מילימטרים בצבע שחור על גבי רקע צהוב המחזיר אור. השלט יוצמד לשוליים התחתונים של השמשה האחורית... נהג שאינו נהג חדש לא ינהג ברכב כאשר מוצמד שלט זה לשמשה האחורית.",
      ),
      // ⬜ The page attributes the sign to תקנות התעבורה without naming a
      // regulation number, and no source found gives one.
      notChecked("מספר התקנה המדויק שמחייב את שלט \"נהג חדש\""),
    ],
  },

  {
    id: 'fz.completion_online',
    track: 'from_zero',
    title: { he: "הצהרת סיום ליווי", en: 'Declare the accompaniment period complete' },
    action: {
      he:
        "הגש את הצהרת נהג חדש על סיום תכנית הליווי — שישה חודשים מיום מתן ההיתר, בטופס מקוון.\n\n" +
        "סיימת את הליווי מוקדם יותר? אפשר להצהיר כבר עכשיו. הרישיון הקבוע עדיין יישלח בתום שישה החודשים.\n\n" +
        "⭐ ברגע שההצהרה אושרה — מותר לך לנהוג עם תעודה מזהה בלבד. אין צורך לחכות שהרישיון יגיע בדואר.",
      en:
        'Submit the new-driver declaration that the accompaniment period is over — six months from the day the permit was issued, on the online form.\n\n' +
        'Finished the accompaniment early? You can declare now. The permanent licence is still sent at the six-month mark.\n\n' +
        '⭐ Once the declaration is confirmed you may drive with photo ID alone. There is no need to wait for the licence to arrive by post.',
    },
    // ⚠️ Corrected 27.8 from the gov.il page: the declaration exists only for
    // someone who actually did a ליווי period, i.e. under 24. A 40-year-old was
    // being told to file a form he is explicitly exempt from.
    applies_when: { all: [HAS_TEUDAT_ZEHUT, { field: 'age_years', op: 'lt', value: 24 }] },
    sequence_position: 13,
    // ⚠️ ordering_constraint, added 22.9 with Chaya. The accompaniment period has to have run before it can be declared over.
    must_come_after: ['fz.new_driver'],
    channel: 'online',
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "הרישיון הקבוע נשלח רק אחרי הצהרת סיום הליווי",
        "הרישיון יישלח רק לאחר הצהרת נהג חדש על סיום תכנית הליווי.",
      ),
      // ⭐ Upgraded 27.8 from a bare link-exists inference to a real quote:
      // Chaya supplied the gov.il text, which gives the timing, the online-only
      // channel, and that you may declare early.
      servicePage(
        "נהג חדש ומלווה",
        "מתי מגישים, שההגשה מקוונת בלבד, ושאפשר להגיש מוקדם",
        "על הנהג, כתנאי לקבלת רישיון נהיגה כנהג חדש אשר סיים את תכנית הליווי, להצהיר על כך באופן מקוון בלבד, באמצעות הטופס המקוון, שישה חודשים מיום מתן ההיתר. ניתן להגיש את ההצהרה גם אם הסתיים הליווי וטרם חלפו שישה חודשים. במקרה זה, יישלח הרישיון הקבוע לביתו של הנהג החדש בתום שישה חודשים.",
      ),
      // ⭐ The line that answers the year she spent waiting for a card.
      servicePage(
        "נהג חדש ומלווה",
        "אחרי אישור ההצהרה מותר לנהוג עם תעודה מזהה בלבד",
        "בסיום תהליך ההצהרה וקבלת אישור כי התהליך הושלם בהצלחה, רשאי הנהג לנהוג ברכב כשברשותו תעודה מזהה ללא צורך בהמתנה לקבלת הרישיון בדואר.",
      ),
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
      he:
        "ההצהרה מוגשת שישה חודשים מיום מתן ההיתר. סיימת את הליווי מוקדם יותר? אפשר להצהיר כבר עכשיו, והרישיון הקבוע עדיין יישלח בתום שישה החודשים.\n\n" +
        "⚠️ עפ״י דיווחים, למי שאין תעודת זהות ההצהרה אינה מקוונת: קבע תור, הגע למשרד הרישוי עם כל המסמכים, והפקיד מצהיר במערכת במקומך.\n\n" +
        "⭐ ברגע שההצהרה אושרה — מותר לך לנהוג עם תעודה מזהה בלבד. אין צורך לחכות שהרישיון יגיע בדואר.",
      en:
        'The declaration is filed six months from the day the permit was issued. Finished the accompaniment early? You can declare now, and the permanent licence is still sent at the six-month mark.\n\n' +
        '⚠️ From what people report, without a teudat zehut it is not online: book an appointment, bring all your documents, and the clerk files it for you.\n\n' +
        '⭐ Once the declaration is confirmed you may drive with photo ID alone. No need to wait for the licence to arrive by post.',
    },
    // ⚠️ Same correction: only someone who did a ליווי declares its end.
    applies_when: { all: [NO_TEUDAT_ZEHUT, { field: 'age_years', op: 'lt', value: 24 }] },
    sequence_position: 13,
    // ⚠️ ordering_constraint, added 22.9 with Chaya. The accompaniment period has to have run before it can be declared over.
    must_come_after: ['fz.new_driver'],
    channel: 'licensing_office',
    requires_appointment: true,
    evidence: [
      // ⚠️ The official page says "מקוון בלבד". Her documented experience is the
      // opposite. The page does not merely omit the exception — it states the
      // reverse, which is how someone ends up expecting a form that is not there.
      servicePage(
        "נהג חדש ומלווה",
        "מתי מגישים, ושאפשר להגיש מוקדם",
        "על הנהג, כתנאי לקבלת רישיון נהיגה כנהג חדש אשר סיים את תכנית הליווי, להצהיר על כך באופן מקוון בלבד, באמצעות הטופס המקוון, שישה חודשים מיום מתן ההיתר. ניתן להגיש את ההצהרה גם אם הסתיים הליווי וטרם חלפו שישה חודשים. במקרה זה, יישלח הרישיון הקבוע לביתו של הנהג החדש בתום שישה חודשים.",
      ),
      servicePage(
        "נהג חדש ומלווה",
        "אחרי אישור ההצהרה מותר לנהוג עם תעודה מזהה בלבד",
        "בסיום תהליך ההצהרה וקבלת אישור כי התהליך הושלם בהצלחה, רשאי הנהג לנהוג ברכב כשברשותו תעודה מזהה ללא צורך בהמתנה לקבלת הרישיון בדואר.",
      ),
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
    // ⚠️ ordering_constraint, added 22.9 with Chaya. Paid for after the accompaniment is settled, by whichever of the three
    // routes applies to him.
    must_come_after: ['fz.completion_online', 'fz.completion_in_person', 'fz.no_declaration_needed'],
    channel: 'post_office',
    cost: {
      amount_ils: 20,
      max_ils: 30,
      note: { he: "משולם בסניף דואר.", en: 'Paid at a post office.' },
      evidence: [
        // ⚠️ גיליון 14 item 10 had voided the old ~30 ₪ figure as a mix-up with
        // the 23 ₪ duplicate fee. Chaya re-confirmed 25.8 that the first issue
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
    id: 'fz.no_declaration_needed',
    track: 'from_zero',
    title: { he: "אין צורך בהצהרת סיום ליווי", en: 'No completion declaration needed' },
    action: {
      he: "מגיל 24 ומעלה אין חובת ליווי, ולכן אין גם טופס הצהרה להגיש. הרישיון יישלח אליך בדואר. ⚠️ אבל תנאי נהג חדש עדיין חלים עליך.",
      en: 'From 24 upwards there is no accompaniment requirement, so there is no declaration form to file either. The licence is posted to you. ⚠️ New-driver conditions still apply to you.',
    },
    // ⚠️ Added 27.8. A 40-year-old was being shown a declaration step he is
    // explicitly exempt from. Saying nothing would leave him wondering; saying
    // this closes it.
    applies_when: { field: 'age_years', op: 'gte', value: 24 },
    sequence_position: 13,
    channel: 'unknown',
    evidence: [
      servicePage(
        "נהג חדש ומלווה",
        "מגיל 24 יש פטור מהליווי ומטופס ההצהרה, אך לא מתנאי נהג חדש",
        "נהג שגילו 24 ומעלה פטור מהגשת טופס הצהרת סיום הליווי, אולם עדיין חלים עליו תנאי נהג חדש. ורישיון הנהיגה יישלח אליו באמצעות הדואר.",
      ),
    ],
  },

  {
    id: 'fz.receive_card',
    track: 'from_zero',
    title: { he: "קבלת רישיון הנהיגה הקבוע", en: 'Receive the permanent licence' },
    action: {
      he: "כרטיס הפלסטיק נשלח בדואר לכתובת המעודכנת ברשות האוכלוסין, ואמור להגיע תוך כחודש.",
      en: 'The plastic card is posted to the address registered with the Population Authority, and should arrive within about a month.',
    },
    applies_when: EVERYONE,
    sequence_position: 15,
    // ⚠️ ordering_constraint, added 22.9 with Chaya. Nothing is posted until it has been paid for.
    must_come_after: ['fz.plastic_fee'],
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

  /**
   * ⭐⭐ THE DUPLICATE, SPLIT BY CHANNEL — Chaya, 31.8.
   *
   *   "the כפל רישיון when the licence don't arrive is valid to everyone who
   *    doesn't get it. but the difference is with the ID. the regular way for
   *    someone who has an ID is [the gov.il service] and he doesn't have to
   *    actually go to משרד הרישוי או דואר, and someone who doesn't have an ID
   *    has to do that with booking the appointments etc."
   *
   * ⭐ This is גיליון F0's central finding, and the step was contradicting it:
   * "ת״ז אינה משנה זכאות, היא משנה ערוץ." The entitlement to a replacement is
   * identical for everybody whose card never arrives. What changes is that an
   * online service becomes an appointment, a queue and a post office.
   *
   * It was one step, scoped to EVERYONE, describing only the physical route —
   * so a person holding a teudat zehut was told to book an appointment and pay
   * at a post office for something he can do from his sofa.
   *
   * ⚠️ track: 'both'. A converted licence arrives by post too, and can fail to
   * arrive in exactly the same way. `must_come_after` names the receive step of
   * each route; only the one actually on his road can hold him up.
   */
  {
    id: 'duplicate.online',
    track: 'both',
    title: { he: "הכרטיס לא הגיע — הוצאת העתק מקוונת", en: 'The card never arrived: online replacement' },
    action: {
      he:
        "הגש בקשה להוצאת העתק רישיון באתר משרד התחבורה. אין צורך בתור, ואין צורך להגיע למשרד הרישוי או לסניף דואר.\n\n" +
        "לאחר התשלום, ותוך 48 שעות — היכנס ל-fastdl.co.il ובחר את אופן המסירה: איסוף עצמי בדפוס בארי (ללא תשלום), שליח עד הבית, דואר, נתב\"ג, דואר רשום או מעברי גבול.",
      en:
        'Submit a duplicate licence request on the Ministry of Transport website. No appointment is needed, and there is no need to attend a licensing office or a post office.\n\n' +
        'After payment, within 48 hours, go to fastdl.co.il and choose the delivery method: self-collection at Defus Bari (free), courier, post, Ben Gurion airport, registered post or border crossings.',
    },
    applies_when: { field: 'has_teudat_zehut', op: 'eq', value: true },
    sequence_position: 16,
    must_come_after: ['fz.receive_card', 'cv.receive'],
    channel: 'online',
    requires_appointment: false,
    links: [
      { label: { he: "הוצאת העתק רישיון", en: 'Duplicate licence service' }, url: 'https://www.gov.il/he/service/duplicate_drivers_license_in_case_of_loss' },
      { label: { he: "בחירת אופן המסירה", en: 'Choose delivery' }, url: 'https://fastdl.co.il/' },
    ],
    fallback: {
      he: "אין לך כתובת רשומה? בחר איסוף עצמי בדפוס בארי — ללא תשלום, ואינו תלוי בכתובת.",
      en: 'No registered address? Choose self-collection at Defus Bari. It is free and does not depend on an address.',
    },
    /**
     * ⚠️ NO cost block, deliberately. The 23 ₪ is a field report from the
     * POST OFFICE route, and whether the online channel charges the same is not
     * something anybody checked. Restating it here would turn an observation
     * about one channel into a claim about another.
     */
    evidence: [
      official(
        'דף "הוצאת העתק רישיון נהיגה", משרד התחבורה',
        "השירות מוצע כשירות מקוון, וחלון שינוי אופן המסירה מתועד",
        "ביום שאחרי ביצוע התשלום ועד 2 ימי עסקים, ניתן לשנות את אופן קבלת הרישיון ואת יעד המסירה.",
        'https://www.gov.il/he/service/duplicate_drivers_license_in_case_of_loss',
        LAST_VERIFIED_LATE,
      ),
      fieldReport(
        "מי שברשותו תעודת זהות מבצע את הבקשה מקוון ואינו נדרש להגיע למשרד הרישוי או לסניף דואר",
        { last_verified_at: '2026-08-31' },
      ),
      notChecked("גובה האגרה בערוץ המקוון — לא אומת. 23 ₪ נצפו בערוץ הפיזי בלבד"),
    ],
  },

  {
    id: 'duplicate.in_person',
    track: 'both',
    title: { he: "הכרטיס לא הגיע — הוצאת העתק בהגעה אישית", en: 'The card never arrived: replacement in person' },
    action: {
      he:
        "קבע תור למשרד הרישוי ובקש הוצאת כפל רישיון. שלם 23 ₪ בסניף דואר.\n\n" +
        "תוך 48 שעות מהתשלום — היכנס ל-fastdl.co.il ובחר איך לקבל את הרישיון:\n" +
        "· איסוף עצמי בדפוס בארי — ללא תשלום, ואינו דורש כתובת רשומה\n" +
        "· שליח עד הבית — בתשלום\n" +
        "· דואר לכתובת\n" +
        "· וגם: נתב\"ג · דואר רשום · מעברי גבול",
      en:
        'Book a licensing office appointment and request a duplicate licence. Pay 23 ILS at a post office.\n\n' +
        'Within 48 hours of paying, go to fastdl.co.il and choose how to receive the licence:\n' +
        '· Self-collection at Defus Bari — free, no registered address needed\n' +
        '· Courier to your door — paid\n' +
        '· Post to an address\n' +
        '· Also: Ben Gurion airport · registered post · border crossings',
    },
    // ⚠️ The SAME entitlement as the step above. Only the channel differs.
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 16,
    must_come_after: ['fz.receive_card', 'cv.receive'],
    channel: 'licensing_office',
    requires_appointment: true,
    links: [
      { label: { he: "הוצאת העתק רישיון", en: 'Duplicate licence service' }, url: 'https://www.gov.il/he/service/duplicate_drivers_license_in_case_of_loss' },
      { label: { he: "בחירת אופן המסירה", en: 'Choose delivery' }, url: 'https://fastdl.co.il/' },
      { label: { he: "זימון תור", en: 'Book an appointment' }, url: 'https://www.gov.il/he/Departments/General/govisit' },
    ],
    fallback: {
      he: "אין לך כתובת רשומה? בחר איסוף עצמי בדפוס בארי — ללא תשלום, ואינו תלוי בכתובת.",
      en: 'No registered address? Choose self-collection at Defus Bari. It is free and does not depend on an address.',
    },
    cost: {
      amount_ils: 23,
      note: { he: "ייתכן תשלום נוסף לפי אופן המשלוח שתבחר.", en: 'There may be an extra charge depending on the delivery method chosen.' },
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
