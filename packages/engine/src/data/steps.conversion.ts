import { RECORD_RELEVANT, GRADES_176_181, GRADES_182_185 } from './rules';
import type { StepInput } from '../domain';
import type { Condition } from '../condition';
import { nohal, servicePage, official, fieldReport, inferred, notChecked, conversionPage, LAST_VERIFIED_LATE } from './sources';

/**
 * ============================================================================
 * מסלול המרה — converting a foreign licence
 * ============================================================================
 *
 * Source: גיליון 03_מסלול_המרה, assembled per גיליונות F2 and F3.
 * Primary source is the נוהל itself, read cover to cover: 12 of 16 rows verified
 * word for word, 2 partial, 2 with no source at all.
 *
 * ⚠️ Evidence profile is the exact inverse of מסלול מאפס, and this matters:
 * entitlement here is documented in detail, but NOT ONE PERSON has been observed
 * going through this route without a teudat zehut. Every field report in the
 * research comes from the from-zero track (open question 23). So where מאפס is
 * thin on paper and rich in experience, המרה is the opposite. F3 opens by
 * telling the user exactly that.
 */

const NO_TEUDAT_ZEHUT: Condition = { field: 'has_teudat_zehut', op: 'eq', value: false };
const EVERYONE: Condition = { always: true };

/**
 * D-209 (4.11.2026). The service page's tab for תושבי חוץ asks for the
 * entries-and-exits report too, so it is no longer one category only.
 */
const ENTRY_EXIT_CATEGORIES: Condition = {
  field: 'nohal_category',
  op: 'in',
  value: ['toshav_israel', 'toshav_medinat_chutz'],
};
const LICENCE_NOT_ENGLISH: Condition = { field: 'foreign_license_language', op: 'ne', value: 'en' };
const UNDER_FIVE_YEARS: Condition = { field: 'foreign_license_years', op: 'lt', value: 5 };

/**
 * ס' 2 לנוהל. Five years on a PERMANENT national licence, in a grade equivalent
 * to תקנות 176-180, AND a רקורד to prove the issue date.
 *
 * ⚠️ Three things people get wrong here, all of them in the research:
 *   · "קבוע" is a condition — a learner or temporary licence does not count.
 *     The word was dropped from a quote in גיליון 06 and had to be restored.
 *   · The exemption is DOUBLE: מבחן שליטה AND בדיקת ראייה (תיקון 4).
 *   · It stops at 180. C1 (תקנה 181) is required to sit מבחן שליטה however long
 *     he has held the licence (תיקון 6).
 *
 * And without a רקורד there is no exemption in practice, whatever the seniority,
 * because there is no way to prove the issue date.
 */
/**
 * ⚠️⚠️ FIXED 30.8, after a coverage sweep found held_class was read by NO rule
 * in the entire engine. The founder: "be critical, find things."
 *
 * The condition tested `requested_class` alone. The נוהל says:
 *
 *   "מבקש שהיה בעל רישיון נהיגה לאומי קבוע במשך חמש שנים לפחות
 *    מדרגה המקבילה לאחת המנויות בתקנה 176 עד 180"
 *
 * "שהיה בעל ... מדרגה המקבילה" is about the grade he HELD. The five years have
 * to be ON a grade inside 176-180. The engine was reading the grade he is
 * ASKING FOR instead, which is a different sentence.
 *
 * ⚠️ THE PERSON IT HURT: twenty years driving a C1 (תקנה 181) abroad, applying
 * for a B. The old condition saw "requested B" and declared him exempt from
 * מבחן שליטה AND בדיקת ראייה. His seniority is on 181, outside the range, so
 * the נוהל does not exempt him. He would have arrived expecting to walk out
 * with a licence and been sent to sit two tests he had not prepared for.
 *
 * ⭐ BOTH checks are real and they are different rules, so both stay:
 *   held_class      · ס' 2 — the five years must be ON a grade in 176-180
 *   requested_class · תיקון 6 — C1 (181) requires מבחן שליטה however long he
 *                     has driven, so it can never be the exempt outcome
 *
 * ⚠️ And note what happens when held_class is 'unknown': `in` on an unknown
 * value is unknown, so the exemption is unknown, so the test steps render as
 * uncertain rather than vanishing. Unknown must never quietly grant an
 * exemption — that is the direction that costs somebody a wasted appointment.
 */
const EXEMPT_FROM_TESTS: Condition = {
  all: [
    { field: 'foreign_license_years', op: 'gte', value: 5 },
    { field: 'has_record_document', op: 'eq', value: 'yes' },
    { field: 'held_class', op: 'in', value: ['A2', 'A1', 'A', '1', 'B'] },
    { field: 'requested_class', op: 'in', value: ['A2', 'A1', 'A', '1', 'B'] },
  ],
};

export const CONVERSION_STEPS: StepInput[] = [
  {
    id: 'cv.record',
    track: 'conversion',
    produces_document: 'doc.record',
    title: { he: "השגת \"רקורד\" ממדינת המוצא", en: 'Get your "record" from your home country' },
    action: {
      he: "בקש מהרשות המוסמכת במדינת המוצא אסמכתה המציינת את המועד שבו הוצא לך רישיון הנהיגה הקבוע. מתקבל גם בדוא\"ל — אפשר להתחיל מרחוק היום.",
      en: 'Ask the competent authority in your home country for a document stating when your permanent licence was issued. Email is accepted, so you can start this remotely today.',
    },
    /**
     * ⭐⭐ SCOPED 23.9, from the נוהל itself after the founder sent the PDF. It was
     * EVERYONE, which is wrong twice over. The document lists say, identically
     * in all three categories:
     *
     *   "רקורד - למעוניינים בקבלת פטור ממבחן שליטה ובדיקת ראיה (בעלי רישיון
     *    נהיגה לאומי קבוע במשך חמש שנים לפחות, כאמור) נדרש להציג אסמכתה..."
     *
     * Conditional twice: only for a person who WANTS the exemption, and only a
     * five-year holder can want it. Under five years it buys nothing, so
     * putting a 60-day chase on his road is pure cost.
     *
     * ⚠️ `gte 5` on an unanswered seniority is UNKNOWN, not false, so the step
     * renders as uncertain rather than vanishing. A long-lead item must never
     * be hidden by a question nobody asked.
     */
    /**
     * ⭐⭐ 23.9 (the founder): "only require the record at the שאלון with a condition
     * of 5+ years, and then only mention it as a STEP if he doesn't have one,
     * and as optional — and to bring it to the visit if he has it."
     *
     * So the step is the ACT of obtaining one, and a man who already holds it
     * has nothing to obtain. For him the רקורד is only a document to bring,
     * which is exactly where the נוהל puts it: פרק "מסמכים נדרשים", never
     * פרק "התהליך".
     */
    applies_when: {
      all: [RECORD_RELEVANT, { field: 'has_record_document', op: 'ne', value: 'yes' }],
    },
    /** ⚠️ Offered, never required. ס' 2 gives the exemption; nothing demands it. */
    optional: {
      buys: {
        he: "פטור ממבחן שליטה ומבדיקת ראייה",
        en: 'Exemption from the control test and the eye test',
      },
    },
    // ⭐ Needed at the END, started on DAY ONE. גיליון 13 principle 3:
    // "אם מציגים אותו בסוף — המשתמש כבר איחר."
    //
    // ⚠️ And NOT a prerequisite of cv.attend, deliberately. "למעוניינים בקבלת
    // פטור" is an offer, not a condition of converting. A man who never gets
    // one still attends, still converts, and simply sits the eye test and the
    // control test. Gating the visit on it would tell a person whose country
    // issues no such document that he can never go at all.
    sequence_position: 1,
    act_when: 'start_now',
    /**
     * ⚠️ `lead_time_days: 60` REMOVED 23.9, the founder. The נוהל does say 60 days —
     * "מומלץ להגיש את הבקשה ולהתחיל את התהליך לכל הפחות 60 ימים לפני תום שנת
     * שהייה בישראל" — but that is about submitting the APPLICATION before the
     * first year of stay runs out, and has nothing to do with how long a
     * foreign authority takes to answer. The number had been carried across to
     * the record with no source of its own.
     *
     * Nothing is lost by dropping it: `lead_time_days` is read by no rule and
     * no screen, and `act_when: 'start_now'` is what actually floats this to
     * the top of his road. The real 60 days lives where it belongs, on
     * `clock.foreign_driving` and on `cv.online_form`, both quoted.
     */
    channel: 'origin_country',
    authority: "רשות הרישוי במדינת המוצא",
    checklist: [
      {
        he: "⚠️ האסמכתה חייבת לציין את מועד הוצאת הרישיון הקבוע — לא את מועד הנפקת הכרטיס הנוכחי. זו טעות שמייצרת רקורד חסר תועלת.",
        en: '⚠️ It must state when the PERMANENT licence was first issued, not when your current card was printed. Getting this wrong produces a useless document.',
      },
    ],
    evidence: [
      nohal(
        "פרק \"מסמכים נדרשים\", מופיע בשלוש הרשימות",
        "הרקורד הוא אסמכתה מגורם מוסמך במדינת המוצא על מועד הוצאת הרישיון הקבוע, ומתקבל בדוא\"ל",
        "רקורד - למעוניינים בקבלת פטור ממבחן שליטה ובדיקת ראיה (בעלי רישיון נהיגה לאומי קבוע במשך חמש שנים לפחות, כאמור) נדרש להציג אסמכתה מגורם מוסמך ממדינת המוצא המציינת את מועד הוצאת רישיון הנהיגה הקבוע (ניתן גם באמצעות דוא\"ל).",
      ),
      nohal(
        "ס' 2",
        "הפטור שהרקורד קונה הוא כפול: מבחן שליטה וגם בדיקת ראייה",
        "מבקש שהיה בעל רישיון נהיגה לאומי קבוע במשך חמש שנים לפחות מדרגה המקבילה לאחת המנויות בתקנה 176 עד 180 לתקנות - פטור מבדיקת ראיה וממבחן שליטה.",
      ),
      // ⚠️ The single largest practical blocker in this route, and the נוהל is
      // silent on all of it. Open question 16.
      notChecked(
        "מיהו \"גורם מוסמך\", מה הפורמט הנדרש, ומה עושה מי שמדינת המוצא אינה מנפיקה מסמך כזה",
      ),
    ],
  },

  /**
   * ⭐ DELETED 23.9 (the founder): there used to be a step here, "update your name in
   * English at the Population Authority", at sequence_position 2. It was a
   * second copy of `cc.english_name_match`, which already guards
   * `cv.online_form` and already carries the consequence and the remedy.
   *
   * Her words: "most people already have it — I didn't have to do it. If I saw
   * it I wouldn't know what to do and it would confuse me." A standing fact
   * printed as a task tells a person who is already fine that he is missing
   * something. It is a reminder to CHECK, not a thing to complete, so it lives
   * as a condition and nowhere else. Position 2 is deliberately vacant;
   * sequence_position is only ever compared, never counted.
   */

  /**
   * ⭐⭐ BACK 4.11.2026 (D-209, the founder). Deleted on 23.9 because the נוהל
   * never names it. The conversion SERVICE page does, word for word, for תושבי
   * חוץ: no 89, walk in without an appointment, show a valid passport, get one.
   * Her hunch from 23.9 ("at the visit the person will get the 89 anyway") was
   * right about the number and wrong only about when: it comes BEFORE the form,
   * because the form's "מספר זהות" field takes it.
   *
   * The `do you already have it?` question comes for free: the step produces
   * doc.form_89, so D-129 asks before sending him (holds_form_89).
   */
  {
    id: 'cv.doc_89',
    track: 'conversion',
    produces_document: 'doc.form_89',
    title: { he: "הוצאת מספר מזהה 89 (\"הטופס הלבן\")", en: 'Get your 89 identity number (the "white form")' },
    action: {
      he:
        "הגע למשרד הרישוי בלי זימון תור, עם דרכון בתוקף. תקבל מספר מזהה שמתחיל ב-89.\n\n" +
        "⭐ את המספר הזה תרשום בטופס המקוון בשדה \"מספר זהות\", ואת המסמך תביא לתחנת הצילום ולתור במשרד הרישוי.",
      en:
        'Go to a licensing office without an appointment, with a valid passport. You get an identity number starting with 89.\n\n' +
        '⭐ You enter this number in the online form as your "ID number", and bring the document to the photo station and to your licensing office appointment.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 1,
    channel: 'licensing_office',
    authority: "משרד הרישוי",
    requires_appointment: false,
    requires_documents: ['doc.passport'],
    checklist: [{ he: "הדרכון מקורי ובתוקף?", en: 'Is your passport the original, and valid?' }],
    evidence: [
      conversionPage(
        "איך מגישים את הבקשה",
        "מי שאין לו מספר 89 מגיע למשרד הרישוי בלי תור, מציג דרכון בתוקף ומקבל מספר מזהה",
        "אם אין ברשותכם מספר מזהה (89), יש להגיע למשרד הרישוי ללא זימון תור, להציג דרכון בתוקף ולקבל מספר מזהה (89).",
      ),
    ],
  },

  /**
   * ⭐ BACK 4.11.2026 (D-209). Deleted 23.9 as "not in פרק התהליך". The
   * service page's document list for תושבי חוץ names it.
   *
   * ⚠️ CONFLICT, kept visible rather than resolved by guessing: our earlier
   * research says the Population Authority issues this report to citizens and
   * residents, so a תושב מדינת חוץ may not be able to get it at all. The
   * founder's D-092 decides the direction: a needless requirement costs a
   * question, a missed one costs a trip. So it is on the road, with a check.
   */
  {
    id: 'cv.entry_exit_form',
    track: 'conversion',
    // ⚠️ No produces_document: doc.entry_exit_form has no held_when, so the
    // step could never be marked done and the report would read "missing"
    // forever. Silence stays "unconfirmed" (readiness.ts, rule 5).
    title: { he: "אישור כניסות ויציאות מרשות האוכלוסין", en: 'Entries and exits report from the Population Authority' },
    action: {
      he: "בקש מרשות האוכלוסין אישור על הכניסות והיציאות שלך מישראל ב-5 השנים האחרונות.",
      en: 'Ask the Population Authority for a report of your entries to and exits from Israel over the last 5 years.',
    },
    applies_when: ENTRY_EXIT_CATEGORIES,
    sequence_position: 5,
    channel: 'population_authority',
    authority: "רשות האוכלוסין",
    notes: [
      {
        he: "⚠️ לא ברור שרשות האוכלוסין מנפיקה את האישור למי שאינו אזרח או תושב. בדוק איתם לפני שאתה מגיע למשרד הרישוי.",
        en: "⚠️ It is not clear the Population Authority issues this report to someone who is not a citizen or resident. Check with them before your licensing office visit.",
        when: { field: 'nohal_category', op: 'eq', value: 'toshav_medinat_chutz' },
      },
    ],
    evidence: [
      conversionPage(
        "מה צריך לצרף לבקשה",
        "תושב חוץ נדרש לצרף אישור כניסות ויציאות ממשרד הפנים מ-5 השנים האחרונות",
        "אישור כניסות ויציאות ממשרד הפנים, מ-5 השנים האחרונות",
      ),
      nohal(
        "פרק \"מסמכים נדרשים\" ← \"תושב ישראל ששהה בחו\"ל לפחות 6 חודשים\", ס' 3",
        "לתושב ישראל ששב הטופס מופיע גם בנוהל",
        "טופס כניסות ויציאות ממשרד הפנים.",
      ),
      notChecked("איך תושב חוץ מקבל את האישור, האם הוא זכאי לבקש אותו, והאם יש אגרה"),
    ],
  },

  /**
   * ⭐ BACK 4.11.2026 (D-209). On 23.9 the translation was read as a power the
   * clerk holds ("רשאית לדרוש"). The service page makes it a requirement:
   * "כשהרישיון לא כתוב באנגלית, יש לצרף". Same condition as doc.translation:
   * only a stated "it is in English" removes it.
   */
  {
    id: 'cv.translation',
    track: 'conversion',
    // ⚠️ No produces_document, same reason as cv.entry_exit_form.
    title: { he: "תרגום נוטריוני של הרישיון", en: 'Notarised translation of your licence' },
    action: {
      he: "הרישיון שלך לא באנגלית: תרגם אותו אצל עורך דין נוטריון שדובר את השפה.",
      en: 'Your licence is not in English: have it translated by a notary who speaks the language.',
    },
    applies_when: LICENCE_NOT_ENGLISH,
    sequence_position: 5,
    channel: 'unknown',
    authority: "עו\"ד נוטריון",
    evidence: [
      conversionPage(
        "מה צריך לצרף לבקשה",
        "רישיון שאינו באנגלית מחייב תרגום מעורך דין נוטריון דובר השפה",
        "כשהרישיון לא כתוב באנגלית, יש לצרף לרישיון תרגום מעורך דין נוטריון דובר השפה",
      ),
    ],
  },

  {
    id: 'cv.online_form',
    track: 'conversion',
    title: { he: "מילוי טופס בקשה מקוון", en: 'Fill in the online application' },
    action: {
      he: "מלא את טופס הבקשה להוצאת רישיון נהיגה באתר משרד התחבורה. אין טופס המרה נפרד — זה אותו טופס של המסלול מאפס.",
      en: 'Fill in the licence application on the Ministry of Transport site. There is no separate conversion form; it is the same one used for the from-scratch route.',
    },
    applies_when: EVERYONE,
    // D-209: the form's ID field takes the 89, so the 89 comes first.
    must_come_after: ['cv.doc_89'],
    notes: [
      {
        he: "בשדה \"מספר זהות\" רשום את מספר ה-89 שקיבלת.",
        en: 'In the "ID number" field, enter the 89 number you received.',
        when: NO_TEUDAT_ZEHUT,
      },
    ],
    /**
     * ⭐ FIRST on the road now (23.9). The נוהל opens פרק "התהליך" with this and
     * nothing before it: "על המבקש למלא טופס בקשה להוצאת רישיון נהיגה באתר
     * משרד התחבורה". It used to wait on `cv.doc_89`, which the נוהל does not
     * have.
     */
    sequence_position: 2,
    channel: 'online',
    authority: "משרד התחבורה",
    links: [{ label: { he: "טופס הבקשה", en: 'The application form' }, url: 'https://www.gov.il/he/service/apply_for_new_driver_drivers_license' }],
    evidence: [
      nohal(
        "פרק \"התהליך\"",
        "הבקשה מוגשת בטופס המקוון של משרד התחבורה, והנוהל עצמו מקשר לדף המסלול מאפס",
        "על המבקש למלא טופס בקשה להוצאת רישיון נהיגה באתר משרד התחבורה.",
      ),
      nohal(
        "פרק \"הערות\"",
        "מומלץ להתחיל לפחות 60 יום לפני תום שנת השהייה",
        "מומלץ להגיש את הבקשה ולהתחיל את התהליך לכל הפחות 60 ימים לפני תום שנת שהייה בישראל.",
      ),
      conversionPage(
        "איך מגישים את הבקשה",
        "מספר ה-89 נרשם בטופס הדיגיטלי בשדה מספר זהות",
        "יש למלא טופס דיגיטלי להוצאת רישיון נהיגה למלא את מספר הזיהוי שהתקבל (89) ב\"מספר זהות\".",
      ),
    ],
  },

  {
    id: 'cv.photo',
    track: 'conversion',
    title: { he: "תחנת צילום", en: 'Photo station' },
    action: {
      he: "אחרי מילוי הטופס, גש לאחת מתחנות הצילום עם תעודה מזהה (תעודת זהות, דרכון או המסמך עם מספר ה-89) והצטלם. הצילום חינם.\n\nאחרי הצילום תקבל SMS או שיחה. רק אחריהם אפשר להתקדם להגעה למשרד הרישוי.",
      en: 'After submitting the form, go to a photo station with photo ID (ID card, passport, or the document with your 89 number). The photo is free.\n\nAfterwards you get an SMS or a call. Only then can you move on to the licensing office visit.',
    },
    applies_when: EVERYONE,
    sequence_position: 3,
    must_come_after: ['cv.online_form'],
    channel: 'photo_station',
    links: [{ label: { he: "תחנות צילום", en: 'Photo stations' }, url: 'https://www.gov.il/he/service/drivers_license_photo_stations' }],
    evidence: [
      nohal(
        "פרק \"התהליך\"",
        "הצילום בא אחרי הטופס המקוון, עם תעודת זהות או דרכון",
        "לאחר מילוי הטופס הנ\"ל יש לגשת לאחת מתחנות הצילום עם תעודה מזהה (תעודת זהות/דרכון) ולהצטלם.",
      ),
      conversionPage(
        "איך מגישים את הבקשה",
        "בתחנת הצילום מציגים תעודה מזהה או את המסמך עם ה-89, ומתקדמים רק אחרי SMS או שיחה",
        "יש לגשת לאחת מתחנות הצילום עם תעודה מזהה (תעודת זהות או דרכון) או המסמך עם מספר הזיהוי שהתקבל, להצטלם ולעבור בדיקות ראייה. לאחר קבלת מסרון או שיחה קולית ניתן להתקדם בתהליך.",
      ),
      official(
        'דף "תחנות צילום לרישיון נהיגה", משרד התחבורה',
        "הצילום להנפקת רישיון אינו כרוך בתשלום",
        "הצילום להנפקה או חידוש רישיון הוא ללא תשלום",
        'https://www.gov.il/he/service/drivers_license_photo_stations',
      ),
    ],
  },

  {
    id: 'cv.eye_test',
    track: 'conversion',
    title: { he: "בדיקת ראייה", en: 'Eye test' },
    action: {
      he: "עבור בדיקת ראייה באחת מהתחנות. נדרש ממי שהוותק שלו ברישיון פחות מחמש שנים, או שאין לו רקורד להוכיח ותק.",
      en: 'Take an eye test at one of the stations. Required if you have held your licence under five years, or cannot prove seniority with a record.',
    },
    applies_when: { not: EXEMPT_FROM_TESTS },
    sequence_position: 4,
    /**
     * D-209, the founder's call: under five years stays a real route. The נוהל
     * allows it (this step and the control test are its price) and she knows
     * someone converting a ~1-year licence right now. The service page says
     * "5 years at least". One small note, nothing louder.
     */
    notes: [
      {
        he: "⚠️ דף השירות של משרד התחבורה כותב שאפשר להמיר רק רישיון עם ותק של 5 שנים לפחות. הנוהל מאפשר גם פחות, בתנאי שעוברים בדיקת ראייה ומבחן שליטה.",
        en: 'The Ministry of Transport service page says only a licence held 5+ years can be converted. The procedure allows less, with an eye test and a control test.',
        when: UNDER_FIVE_YEARS,
      },
    ],
    // ⭐ 23.9: "כמו כן" in פרק התהליך attaches the eye test to the photo-station
    // stage, which the נוהל places "לאחר מילוי הטופס הנ\"ל". Same gate as the
    // photo, same station, same visit.
    must_come_after: ['cv.online_form'],
    channel: 'photo_station',
    links: [{ label: { he: "תחנות צילום ובדיקת ראייה", en: 'Photo stations and eye tests' }, url: 'https://www.gov.il/he/service/drivers_license_photo_stations' }],
    evidence: [
      nohal(
        "פרק \"התהליך\"",
        "חובת בדיקת ראייה למי שוותקו פחות מחמש שנים",
        "בעל רישיון נהיגה בעל ותק פחות מחמש שנים מחוייב לעבור בדיקות ראייה באחת מהתחנות המצויינות בקישור.",
      ),
      // ⚠️ Seniority alone is not enough. Without the רקורד there is no way to
      // prove it, so in practice there is no exemption. A direct inference from
      // two quoted clauses, not a guess.
      inferred(
        "בלי רקורד אין דרך להוכיח ותק, ולכן אין פטור בפועל גם למי שיש לו חמש שנים",
        "הצלבה של ס' 2 לנוהל עם פרק \"מסמכים נדרשים\"",
      ),
      conversionPage(
        "תנאים להגשת הבקשה",
        "דף השירות מציין ותק של 5 שנים לפחות, בסתירה לנוהל שמאפשר פחות עם בדיקות",
        "ניתן להמיר רישיון נהיגה זר בעל ותק של 5 שנים לפחות במדינת המוצא",
      ),
      fieldReport("ממירה עם ותק של כשנה נמצאת כעת בתהליך (מכרה של המייסדת, 11.2026)", {
        last_verified_at: '2026-11-04',
      }),
    ],
  },

  {
    id: 'cv.book_appointment',
    track: 'conversion',
    title: { he: "זימון תור למשרד הרישוי", en: 'Book a licensing office appointment' },
    action: {
      he: "קבע תור לסניף משרד הרישוי דרך GoVisit. אפשר לקבוע בכל שלב, רק להגיע מוכן.\n\n⚠️ הסניפים האלה לא מטפלים בהמרה: בית שאן, צפת, יקנעם, דלית אל כרמל, קריית ארבע, אריאל, אופקים ורהט.",
      en: "Book an appointment at a licensing office branch through GoVisit. You can book at any point, just arrive ready.\n\n⚠️ These branches don't handle conversions: Beit She'an, Safed, Yokne'am, Daliyat al-Karmel, Kiryat Arba, Ariel, Ofakim and Rahat.",
    },
    applies_when: EVERYONE,
    sequence_position: 5,
    channel: 'online',
    requires_appointment: true,
    links: [{ label: { he: "GoVisit — זימון תור", en: 'GoVisit appointment booking' }, url: 'https://www.gov.il/he/Departments/General/govisit' }],
    evidence: [
      nohal(
        "פרק \"התהליך\"",
        "התור נקבע דרך GoVisit, והקישור מופיע בנוהל עצמו",
        "לקבוע תור לסניף משרד הרישוי ולגשת באופן אישי עם המסמכים הדרושים.",
      ),
      conversionPage(
        "איך מגישים את הבקשה",
        "שמונה סניפים אינם מטפלים בהמרה",
        "ניתן להגיש בקשה להמרת רישיון נהיגה זר לרישיון ישראלי בכל סניפי הרישוי ברחבי הארץ, מלבד הסניפים הבאים: בית שאן, צפת, יקנעם, דלית אל כרמל, קריית ארבע, אריאל, אופקים ורהט.",
      ),
    ],
  },

  {
    id: 'cv.attend',
    track: 'conversion',
    title: { he: "הגעה אישית עם המסמכים", en: 'Attend in person with your documents' },
    action: {
      he: "הגע פיזית לסניף משרד הרישוי בתור שקבעת, עם כל המסמכים הנדרשים לקטגוריה שלך.",
      en: 'Go to the licensing office branch on your appointment, with every document your category requires.',
    },
    applies_when: EVERYONE,
    sequence_position: 6,
    /**
     * ⭐⭐ THE ORDERING CHAIN, 23.9, read off the נוהל rather than guessed.
     * פרק "התהליך" in full: fill the form → "לאחר מילוי הטופס הנ\"ל" the photo
     * station → "כמו כן" the eye test for under-five-years → "לקבוע תור לסניף
     * משרד הרישוי ולגשת באופן אישי עם המסמכים הדרושים".
     *
     * Each of these gates only the person it concerns, because a step whose
     * applies_when is false is not on his road and `waiting_on` filters to what
     * is (evaluate.ts). The eye test disappears for an exempt five-year holder;
     * the entries-and-exits form exists only for a returning Israeli resident,
     * whose list carries it as item 3.
     *
     * ⚠️ NOT here, on purpose, and both were nearly added:
     *   cv.record      — "למעוניינים בקבלת פטור", an offer, not a condition.
     *   cv.translation — lives in פרק "הערות" as "רשות הרישוי רשאית לדרוש".
     *                    A power the clerk holds, absent from the process and
     *                    from every document list. Gating on it would block a
     *                    person who has not yet said what language his licence
     *                    is in, since an unknown condition keeps a step on the
     *                    road. That is "unknown rendered as yes".
     */
    // D-209: the 89 and the entries-and-exits report are now things he
    // obtains first, so the visit waits on them too.
    must_come_after: [
      'cv.book_appointment',
      'cv.online_form',
      'cv.photo',
      'cv.eye_test',
      'cv.doc_89',
      'cv.entry_exit_form',
      // ⚠️ NOT cv.translation: an unanswered licence language keeps that step
      // on the road, and the visit must not wait on an unknown.
    ],
    channel: 'licensing_office',
    requires_appointment: true,
    /**
     * ⭐⭐ THE ONE VISIT WHERE HE HANDS EVERYTHING OVER, and it was asking for
     * three documents out of nine.
     *
     * ⚠️ Found 30.8 by a coverage sweep, after the founder asked for a critical pass
     * over the whole system. Four documents were defined in documents.ts with
     * full evidence and were required by NO step anywhere: doc.record,
     * doc.translation, doc.entry_exit_form, doc.teudat_oleh. They existed and
     * nobody was ever told to bring them.
     *
     * ⚠️ THE WORST OMISSION WAS doc.form_89. cv.doc_89 tells him to GO AND GET
     * one, and this step never told him to BRING it — and for a person with no
     * teudat zehut the 89 IS his identity for the entire licence process. He
     * would arrive at his appointment holding a passport and a visa, without
     * the document that identifies him.
     *
     * That is the wasted trip this product exists to prevent, sitting inside
     * the product.
     *
     * ⚠️ doc.record was worse than absent: it appears in the checklist below as
     * "הרקורד הגיע?" — a question about a document the list never told him to
     * carry. It buys exemption from BOTH the control test and the eye test.
     *
     * ⭐ Listing all nine is safe, and that is the point of the 27.8 fix: every
     * document declares its own applies_when, and the engine asks each one
     * whether it applies to THIS person. The 89 disappears for a teudat zehut
     * holder, the עולה certificate appears only for an עולה, the translation
     * only when the licence is not in English. A step names everything the
     * visit could need; the person decides what he actually sees.
     */
    /**
     * ⚠️ `doc.form_89` REMOVED 23.9. The נוהל's three document lists are short
     * and none of them contains it:
     *   עולה חדש          — דרכון/ת"ז · תעודת עולה · רישיון לאומי בתוקף · רקורד
     *   תושב ישראל ששב    — דרכון/ת"ז · רישיון לאומי בתוקף · טופס כניסות ויציאות · רקורד
     *   תושב מדינת חוץ     — רישיון לאומי בתוקף · דרכון עם אשרת שהייה בתוקף · רקורד
     * Each document still decides for itself whether it applies to THIS person,
     * so a man sees his own list and not all of them.
     */
    requires_documents: [
      'doc.identity',
      // D-209: "להגיע עם תעודת זהות ישראלית מקורית או עם מספר מזהה (89)".
      'doc.form_89',
      'doc.passport',
      'doc.visa',
      'doc.foreign_license',
      'doc.record',
      'doc.translation',
      'doc.entry_exit_form',
      'doc.teudat_oleh',
    ],
    links: [{ label: { he: "הנוהל המלא", en: 'The full procedure' }, url: 'https://www.gov.il/he/pages/1961' }],
    checklist: [
      {
        he: "האשרה בתוקף היום? הזכאות נבחנת לרגע ההגשה.",
        en: 'Is your visa valid TODAY? Eligibility is judged at the moment you submit.',
        /**
         * ⚠️ SCOPED 31.8, found by the founder. It had no `when`, so a returning
         * Israeli resident with a teudat zehut was asked whether his visa was
         * valid today. He has no visa. Same failure as the 89 line on 27.8 —
         * "the 89 has nothing to do with him."
         *
         * ⭐ The condition is cc.visa_valid's, not doc.visa's, and the
         * difference is her ruling of 30.8: an א/5 holds a teudat zehut and IS
         * asked, because his card rests on the visa behind it.
         */
        when: {
          any: [
            { field: 'has_teudat_zehut', op: 'eq', value: false },
            { field: 'nohal_category', op: 'eq', value: 'toshav_medinat_chutz' },
          ],
        },
      },
      { he: "הרישיון הזר בתוקף — לא רק קיים?", en: 'Is your foreign licence valid, not merely in your possession?' },
      { he: "כל המסמכים במקור?", en: 'Are all documents originals?' },
      { he: "קיבלת SMS או שיחה אחרי תחנת הצילום?", en: 'Did you get the SMS or call after the photo station?' },
      {
        /**
         * ⭐ SCOPED 23.9. It had no `when`, so a two-year holder — who has no
         * record step and no record document — was asked at the counter whether
         * his record had arrived. The founder's rule: nothing that does not need
         * mentioning gets mentioned. Same rule as the 31.8 visa line above.
         */
        he: "הרקורד הגיע?",
        en: 'Has the record arrived?',
        when: RECORD_RELEVANT,
      },
    ],
    evidence: [
      nohal(
        "פרק \"התהליך\"",
        "הנוהל מגדיר הגעה פרונטלית עם המסמכים",
        "לקבוע תור לסניף משרד הרישוי ולגשת באופן אישי עם המסמכים הדרושים.",
      ),
      conversionPage(
        "איך מגישים את הבקשה",
        "מגיעים לתור עם תעודת זהות מקורית או עם מספר 89, ועם המסמכים הנדרשים",
        "יש לזמן תור מראש למשרד הרישוי ולהגיע עם תעודת זהות ישראלית מקורית או עם מספר מזהה (89), ולצרף את המסמכים הנדרשים.",
      ),
      // ⚠️ Careful wording. "There is no online route" is a NEGATIVE claim the
      // נוהל never makes. It describes one route, and that route is physical.
      inferred(
        "הנוהל מגדיר מסלול פרונטלי בלבד — אך אינו כותב שאין מסלול מקוון",
        "גיליון 03 שורה 11 · טענת שלילה שאינה בנוהל",
      ),
    ],
  },

  {
    id: 'cv.verification',
    track: 'conversion',
    /**
     * ⭐ RENAMED 23.9 (the founder): "הגעה אישית עם המסמכים" and "בדיקה ואימות
     * המסמכים" read as the same thing two rows apart. This one is not him
     * doing anything — it is the authority deciding.
     */
    title: {
      he: "בדיקה ואישור ההמרה ע\"י משרד הרישוי",
      en: 'The licensing office checks and approves the conversion',
    },
    action: {
      he: "רשות הרישוי בודקת ומאמתת את המסמכים על פי שיקול דעתה, וככל הניתן בתוך 14 ימי עבודה. ⚠️ זהו יעד רך ולא התחייבות.\n\nייתכן שיזמנו אותך שוב למשרד הרישוי לבדיקת סטטוס הרישיון.",
      en: 'The licensing authority checks and verifies your documents at its discretion, as far as possible within 14 working days. ⚠️ That is a soft target, not a commitment.\n\nYou may be called back to the licensing office for a licence status check.',
    },
    applies_when: EVERYONE,
    sequence_position: 7,
    must_come_after: ['cv.attend'],
    lead_time_days: 14,
    channel: 'licensing_office',
    authority: "רשות הרישוי",
    evidence: [
      nohal(
        "פרק \"הערות\", תבליט 3",
        "האימות נעשה על פי שיקול דעת הרשות וככל הניתן בתוך 14 ימי עבודה — יעד רך, לא SLA",
        "רשות הרישוי רשאית לבדוק ולאמת מסמכים על פי שיקול דעתה וככל הניתן בתוך 14 ימי עבודה מיום הגשת הבקשה.",
      ),
      // ⚠️ A broad discretion that is not limited to any grade, and "טעמים
      // מיוחדים" is never defined. The system must never promise that medical
      // tests will not be required.
      {
        claim:
          "רשות הרישוי רשאית להורות מטעמים מיוחדים על בדיקות רפואיות לכל מבקש — והמונח אינו מוגדר בנוהל",
        certainty: 'verified',
        citation:
          "נוהל אופן המרת רישיון נהיגה ממדינת חוץ · אגף הרישוי, משרד התחבורה · 15.2.2024 · סימוכין 4000-0017-2024-0000298 · ס' 1",
        quote:
          "עמידה בבדיקת ראיה כמפורט בתקנות, אלא אם רשות הרישוי הורתה מטעמים מיוחדים שעליו לעמוד גם בבדיקות רפואיות הקבועות בתקנות.",
        url: 'https://www.gov.il/he/pages/1961',
        last_verified_at: '2026-08-21',
        variation_factors: ['clerk_discretion'],
      },
      conversionPage(
        "איך מגישים את הבקשה",
        "ייתכן זימון נוסף למשרד הרישוי לבדיקת סטטוס הרישיון",
        "ייתכן שמגישי הבקשה יזומנו שוב למשרד הרישוי לצורך בדיקת סטטוס הרישיון.",
      ),
    ],
  },

  {
    id: 'cv.control_test',
    track: 'conversion',
    title: { he: "מבחן שליטה", en: 'Control test' },
    action: {
      he: "עבור מבחן שליטה. ⚠️ זהו מבחן שונה ומצומצם מטסט רגיל — לא מבחן מעשי מלא.",
      en: 'Take a control test. ⚠️ This is a different, narrower test than a full driving test.',
    },
    /**
     * ⭐⭐ SCOPED 23.9, and this was a real mismatch with the נוהל.
     *
     * ס' 1 attaches the control test to ONE range and names it:
     *   "לעניין דרגות נהיגה הקבועות בתקנות 176 עד 181 ... נדרשת עמידה גם
     *    במבחן שליטה"
     *
     * It was `{ not: EXEMPT_FROM_TESTS }` alone, and EXEMPT is written around
     * the 176-180 exemption in ס' 2. So a man converting a bus (D) or a truck
     * (C) came out "not exempt" and was handed a מבחן שליטה the נוהל never asks
     * of him — while the four things it DOES ask of him had no steps at all.
     * A heavy-vehicle conversion was being drawn as a car conversion.
     */
    applies_when: { all: [GRADES_176_181, { not: EXEMPT_FROM_TESTS }] },
    sequence_position: 8,
    channel: 'test_center',
    authority: "בוחן משרד התחבורה",
    checklist: [
      {
        he: "⚠️ כישלון פעמיים מפיל אותך למסלול המלא לפי תקנות 191-210 — תיאוריה, שיעורים וטסט. שווה להתכונן ברצינות.",
        en: '⚠️ Failing twice drops you into the full route under regulations 191-210: theory, lessons and a full test. Prepare seriously.',
      },
    ],
    evidence: [
      nohal(
        "ס' 1",
        "מבחן שליטה נדרש לדרגות שבתקנות 176-181",
        "לעניין דרגות נהיגה הקבועות בתקנות 176 עד 181 (דרגות C1, B, A, A1, A2, 1) נדרשת עמידה גם במבחן שליטה.",
      ),
      nohal(
        "ס' 1",
        "כישלון פעמיים מחייב מעבר למסלול המלא לפי תקנות 191-210",
        "במידה ולא עמד המבקש פעמיים במבחן שליטה, לא יינתן לו רישיון נהיגה אלא אם עמד בבדיקות ובחינות כאמור בתקנות 191 עד 210 לתקנות התעבורה.",
      ),
      // ⭐ תיקון 6. The obligation runs to 181, the exemption stops at 180.
      nohal(
        "ס' 2",
        "הפטור חל רק על תקנות 176-180, ולכן דרגה C1 (תקנה 181) מחייבת מבחן שליטה תמיד",
        "מבקש שהיה בעל רישיון נהיגה לאומי קבוע במשך חמש שנים לפחות מדרגה המקבילה לאחת המנויות בתקנה 176 עד 180 לתקנות - פטור מבדיקת ראיה וממבחן שליטה.",
      ),
      // The exact difference from an ordinary test is open question 17.
      notChecked("במה בדיוק שונה מבחן שליטה מטסט רגיל — משך, תוכן, אגרה ומקום"),
    ],
  },

  {
    /**
     * ⭐⭐ ADDED 23.9. ס' 1 names four things for the heavy grades and the
     * roadmap carried none of them:
     *
     *   "לעניין דרגות נהיגה הקבועות בתקנות 182 עד 185 (E, C, D, D1, D2, D3)
     *    נדרש סיום קורס לנהגי רכב ציבורי/כבד, נדרשת עמידה בבדיקות רפואיות
     *    ובבחינות, מילוי אחר תקנה 189(ד)(3) וכן שלא התקיים במבקש האמור
     *    בתקנה 15ב לתקנות."
     *
     * ⚠️ This is the honest shape of it: the נוהל says the course is REQUIRED
     * and says nothing whatever about where it is given, what it costs or how
     * long it takes. So the requirement is quoted and the process is marked
     * never-checked, rather than filled in from somewhere else.
     */
    id: 'cv.heavy_course',
    track: 'conversion',
    title: {
      he: "קורס לנהגי רכב ציבורי/כבד",
      en: 'Course for public-service and heavy-vehicle drivers',
    },
    action: {
      he:
        "לדרגות C, D, D1, D2, D3 ו-E נדרש סיום קורס לנהגי רכב ציבורי/כבד. זו אינה המרה רגילה.\n\n" +
        "⚠️ הנוהל קובע את הדרישה ואינו מתאר היכן הקורס ניתן, כמה הוא עולה או כמה זמן הוא אורך. אין לנו תשובה מאומתת לשאלות האלה.",
      en:
        'Grades C, D, D1, D2, D3 and E require completing a course for public-service and heavy-vehicle drivers. This is not an ordinary conversion.\n\n' +
        '⚠️ The procedure sets the requirement and says nothing about where the course is given, what it costs or how long it takes. We have no verified answer to those questions.',
    },
    applies_when: GRADES_182_185,
    sequence_position: 8,
    act_when: 'start_now',
    channel: 'unknown',
    authority: "משרד התחבורה",
    checklist: [
      {
        he: "⚠️ נדרש גם מילוי אחר תקנה 189(ד)(3), וכן שלא התקיים בך האמור בתקנה 15ב לתקנות. הנוהל מפנה לתקנות ואינו מצטט אותן — כדאי לברר מול אגף הרישוי מה חל עליך.",
        en: '⚠️ Regulation 189(d)(3) must also be satisfied, and the disqualification in regulation 15b must not apply to you. The procedure points at the regulations without quoting them — worth checking with the Licensing Division what applies to you.',
      },
    ],
    evidence: [
      nohal(
        "ס' 1",
        "דרגות 182-185 מחייבות קורס לנהגי רכב ציבורי/כבד, בדיקות רפואיות, בחינות, תקנה 189(ד)(3) ותקנה 15ב",
        "לעניין דרגות נהיגה הקבועות בתקנות 182 עד 185 (E, C, D, D1, D2, D3) נדרש סיום קורס לנהגי רכב ציבורי/כבד, נדרשת עמידה בבדיקות רפואיות ובבחינות, מילוי אחר תקנה 189(ד)(3) וכן שלא התקיים במבקש האמור בתקנה 15ב לתקנות.",
      ),
      notChecked(
        "היכן ניתן הקורס, מה משכו, מה עלותו, ומה בדיוק דורשות תקנה 189(ד)(3) ותקנה 15ב",
      ),
    ],
  },

  {
    /**
     * ⭐⭐ ADDED 23.9, from the same clause. "בחינות" is its own requirement,
     * and it is NOT a מבחן שליטה — that one is scoped to 176-181 and these
     * grades are outside it. Two different words in one sentence of the נוהל,
     * and collapsing them would tell a bus driver to sit the wrong test.
     */
    id: 'cv.heavy_exams',
    track: 'conversion',
    title: { he: "בחינות לדרגות הכבדות", en: 'Examinations for the heavy grades' },
    action: {
      he:
        "לדרגות C, D, D1, D2, D3 ו-E נדרשת עמידה בבחינות.\n\n" +
        "⚠️ הנוהל אינו מפרט אילו בחינות, היכן, או מה תוכנן. אין לנו תשובה מאומתת.",
      en:
        'Grades C, D, D1, D2, D3 and E require passing examinations.\n\n' +
        '⚠️ The procedure does not say which examinations, where, or what they cover. We have no verified answer.',
    },
    applies_when: GRADES_182_185,
    sequence_position: 9,
    must_come_after: ['cv.heavy_course'],
    channel: 'unknown',
    authority: "משרד התחבורה",
    evidence: [
      nohal(
        "ס' 1",
        "דרגות 182-185 מחייבות עמידה בבחינות, לצד הקורס והבדיקות הרפואיות",
        "לעניין דרגות נהיגה הקבועות בתקנות 182 עד 185 (E, C, D, D1, D2, D3) נדרש סיום קורס לנהגי רכב ציבורי/כבד, נדרשת עמידה בבדיקות רפואיות ובבחינות, מילוי אחר תקנה 189(ד)(3) וכן שלא התקיים במבקש האמור בתקנה 15ב לתקנות.",
      ),
      // ⚠️ A negative claim the נוהל DOES make, by naming a different range.
      nohal(
        "ס' 1",
        "מבחן שליטה שייך לדרגות 176-181 בלבד, ולכן אינו חל על הדרגות הכבדות",
        "לעניין דרגות נהיגה הקבועות בתקנות 176 עד 181 (דרגות C1, B, A, A1, A2, 1) נדרשת עמידה גם במבחן שליטה.",
      ),
      notChecked("אילו בחינות בדיוק, היכן הן נערכות ומה תוכנן"),
    ],
  },

  {
    /**
     * ⭐ RENAMED and WIDENED 23.9, from `cv.medical_c1`. ס' 1 imposes medical
     * tests in TWO places, and only one of them was modelled:
     *   "ולעניין הדרגה המנויה בתקנה 181 נדרשת עמידה בבדיקות רפואיות כקבוע
     *    בתקנות"                                              ← C1, was here
     *   "לעניין דרגות נהיגה הקבועות בתקנות 182 עד 185 ... נדרשת עמידה בבדיקות
     *    רפואיות ובבחינות"                                     ← was missing
     * The old id said C1 and the rule now covers more, so the id says so too.
     */
    id: 'cv.medical',
    track: 'conversion',
    title: { he: "בדיקות רפואיות", en: 'Medical tests' },
    action: { he: "עבור את הבדיקות הרפואיות הקבועות בתקנות.", en: 'Complete the medical tests set out in the regulations.' },
    applies_when: {
      any: [{ field: 'requested_class', op: 'eq', value: 'C1' }, GRADES_182_185],
    },
    sequence_position: 9,
    channel: 'unknown',
    authority: "מרב\"ד",
    evidence: [
      nohal(
        "ס' 1",
        "דרגה 181 מחייבת עמידה בבדיקות רפואיות",
        "ולעניין הדרגה המנויה בתקנה 181 נדרשת עמידה בבדיקות רפואיות כקבוע בתקנות.",
      ),
    ],
  },

  {
    id: 'cv.receive',
    track: 'conversion',
    title: { he: "קבלת הרישיון", en: 'Receiving your licence' },
    action: {
      he:
        "במשרד הרישוי תקבל רישיון זמני. אחריו משלמים את האגרה באחד מסניפי דואר ישראל. התשלום מתעדכן אחרי 14 ימי עסקים.\n\n" +
        "הרישיון הקבוע נשלח לכתובת הרשומה ברשות האוכלוסין.",
      en:
        'At the licensing office you receive a temporary licence. Then you pay the fee at an Israel Post branch. The payment updates after 14 business days.\n\n' +
        'The permanent licence is posted to the address registered with the Population Authority.',
    },
    applies_when: EVERYONE,
    sequence_position: 10,
    /**
     * ⭐ 23.9. The נוהל never describes delivery on this route, but it does say
     * what stands between a man and a licence being issued at all:
     *   ס' 1 — "במידה ולא עמד המבקש פעמיים במבחן שליטה, לא יינתן לו רישיון נהיגה"
     *   ס' 1 — "ולעניין הדרגה המנויה בתקנה 181 נדרשת עמידה בבדיקות רפואיות"
     * Each still gates only whom it applies to: the control test vanishes for an
     * exempt holder, the medical exists only for C1.
     */
    must_come_after: ['cv.verification', 'cv.control_test', 'cv.medical', 'cv.heavy_course', 'cv.heavy_exams'],
    channel: 'mail',
    checklist: [
      { he: "הכתובת שלך מעודכנת ברשות האוכלוסין?", en: 'Is your address up to date at the Population Authority?' },
    ],
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "הרישיון הקבוע נשלח לכתובת המעודכנת ברשות האוכלוסין",
        "רישיון נהיגה קבוע (פלסטיק) יישלח לכתובת המעודכנת ברשות האוכלוסין.",
      ),
      // D-209: the uncertainty that lived here (23.9, "the נוהל never describes
      // delivery") is answered by the service page.
      conversionPage(
        "אפשרויות תשלום",
        "רישיון זמני במשרד הרישוי, תשלום בדואר ישראל, עדכון אחרי 14 ימי עסקים, הרישיון הקבוע נשלח בדואר",
        "לאחר קבלת הרישיון הזמני במשרד הרישוי יש לבצע את התשלום באחד מסניפי דואר ישראל. התשלום יתעדכן לאחר 14 ימי עסקים. הרישיון הקבוע יישלח לכתובת הרשומה ברשות האוכלוסין וההגירה.",
      ),
      // ⭐ the founder said a converter with under two years on his foreign licence is
      // a נהג חדש, and then produced a source for it. 🟡 rather than 🟢 because
      // כל-זכות is secondary — and because THIS PAGE contains an error the
      // workbook already caught: it says "מבחן נהיגה מעשי (טסט)" where the נוהל
      // says "מבחן שליטה" (גיליון 00). Right on this point, wrong on that one.
      {
        claim:
          "ותק של פחות משנתיים ברישיון הזר ⟵ המבקש ייחשב \"נהג חדש\" בישראל, על כל המגבלות הנלוות",
        certainty: 'likely',
        citation: 'כל-זכות, "המרת רישיון נהיגה זר לרישיון נהיגה ישראלי", סעיף "למי זה רלוונטי?"',
        quote:
          "עולה חדש עם ותק של פחות מ-5 שנים נדרש לעבור מבחן נהיגה מעשי (טסט). אם יש לו ותק של פחות משנתיים הוא ייחשב \"נהג חדש\".",
        url: 'https://www.kolzchut.org.il/he/המרת_רישיון_נהיגה_זר_לרישיון_נהיגה_ישראלי',
        last_verified_at: '2026-08-25',
        variation_factors: [],
      },
      // ⭐ the founder, 25.8: "doesn't matter if you have an 89 or you're a citizen —
      // it's about whether he had a licence before."
      //
      // That is the axis. נהג חדש is decided by DRIVING HISTORY, not by which
      // identity document you carry and not by your נוהל category. It is the same
      // shape as the two-axis model elsewhere in this system: one thing decides
      // eligibility, a different thing decides the channel, and neither is read
      // off the other.
      //
      // The כל-זכות quote is written about עולה חדש. Applying it to every
      // converter is ours rather than the source's, which is why it is 🟡.
      inferred(
        "מעמד \"נהג חדש\" נקבע לפי ותק הנהיגה — כמה זמן הוא כבר מחזיק ברישיון — ולא לפי מסמך הזיהוי (89 מול תעודת זהות) ולא לפי הקטגוריה בנוהל",
        'הסקה מכל-זכות · לא נכתב שם במפורש',
      ),
      // The under-24 ליווי rule is quoted on the gov.il from-zero page. Applying
      // it to a converter is a join between two sources, so it is 🟡 too.
      inferred(
        "מתחת לגיל 24 חלה תקופת ליווי גם על ממיר — צירוף של כלל הליווי מדף gov.il עם מעמד \"נהג חדש\"",
        'דף השירות "הוצאת רישיון נהיגה" + כל-זכות · לא נכתב במפורש לגבי המרה',
      ),
    ],
  },
];
