import type { VisaProfileInput, CategoryRuleInput } from '../domain';
import { nohal, official, inferred, unresolved, LAST_VERIFIED } from './sources';

/**
 * ============================================================================
 * ELIGIBILITY — the two-axis model
 * ============================================================================
 *
 * Source: גיליונות 02_מטריצת_אשרות, 08_סוגי_אשרות, and 14 section ה.
 *
 * ⭐ גיליון 14 section ה is the one that settled this, on 20.8, and it is the
 * strongest finding in the research:
 *
 *   תקנות הכניסה לישראל תשל"ד-1974 — תקנה 5 defines ב/1 to ב/4 as
 *   "אשרה ורשיון לישיבת ביקור", תקנה 6 defines א/1 to א/5 as
 *   "אשרה ורשיון לישיבת ארעי".
 *
 *   Every code is called "אשרה **ורשיון לישיבת**..." — meaning the code IS a
 *   רישיון ישיבה by the regulations' own name for it. And a רישיון ישיבה is
 *   exactly what ס' 1(ג) לנוהל requires.
 *
 * That turned five rows from 🟡 inference into 🟢 verified in one stroke, and it
 * is also what excludes 2(א)(5): the law separates an אשרה (permission to enter)
 * from a רישיון ישיבה (permission to stay), and 2(א)(5) is neither.
 */

const ENTRY_REGS =
  'תקנות הכניסה לישראל, תשל"ד-1974 · תקנה 5 (ביקור) ותקנה 6 (ארעי)';
const ENTRY_REGS_URL = 'https://www.nevo.co.il/law_html/law00/70322.htm';

/**
 * The shared reason every א/x and ב/x code lands in תושב מדינת חוץ.
 * Written once because it is genuinely one finding, not nine.
 */
const isResidencePermit = (code: string, description: string) =>
  official(
    ENTRY_REGS,
    `הקוד ${code} הוא רישיון ישיבה לפי שמו בתקנות, ולכן נכנס לקטגוריית "תושב מדינת חוץ" שבנוהל ס' 1(ג)`,
    `אשרה ורשיון לישיבת ${description} מסוג ${code}`,
    ENTRY_REGS_URL,
  );

const foreignResidentClause = nohal(
  "ס' 1(ג)",
  "תושב מדינת חוץ זכאי להמרה אם החזיק רישיון ישיבה בעת ההגשה, בתוך 5 שנים מהכניסה, ומוגבל לתקנות 176-181",
  "תושב מדינת חוץ שהגיש את בקשתו בעת שהיה ברשותו רישיון ישיבה בישראל, ובלבד שהגיש את בקשתו בתוך חמש שנים מיום כניסתו לישראל ובלבד שרשות הרישוי לא תיתן לו רישיון נהיגה אלא לפי תקנות 176-181 (דרגות C1, B, A, A1, A2, 1).",
);

// ─────────────────────────────────────────────────────────────────────────────
// Axis 1 · which category each status falls into
// ─────────────────────────────────────────────────────────────────────────────

export const VISA_PROFILES: VisaProfileInput[] = [
  {
    visa_type: 'a1',
    label: { he: "א/1 · אשרת עולה", en: 'A/1 · Oleh visa' },
    nohal_category: 'oleh_chadash',
    usually_has_teudat_zehut: false,
    identity_document: { he: "דרכון + אשרה", en: 'Passport + visa' },
    caveat: {
      he: "עד לעלייה בפועל. אחריה מתקבלת תעודת זהות.",
      en: 'Until aliyah itself. After it, you receive a teudat zehut.',
    },
    evidence: [
      nohal(
        "ס' 1(א)",
        "עולה חדש זכאי להמרה בתוך חמש שנים מיום העלייה",
        "נמצא בישראל לפי אשרת עולה או תעודת עולה לפי חוק השבות, התש\"י-1950 והגיש את בקשתו בתוך חמש שנים מיום עלייתו.",
      ),
    ],
  },

  {
    visa_type: 'a2',
    label: { he: "א/2 · תלמיד / סטודנט", en: 'A/2 · Student' },
    nohal_category: 'toshav_medinat_chutz',
    usually_has_teudat_zehut: false,
    identity_document: { he: "דרכון + אשרת שהייה", en: 'Passport + residence visa' },
    caveat: {
      he: "האשרה תלויה במוסד הלימודים. סיום לימודים עלול להפיל את הזכאות באמצע התהליך.",
      en: 'The visa depends on your institution. Finishing your studies can void eligibility mid-process.',
    },
    evidence: [isResidencePermit('א/2', 'ארעי'), foreignResidentClause],
  },

  {
    visa_type: 'a3',
    label: { he: "א/3 · איש דת", en: 'A/3 · Clergy' },
    nohal_category: 'toshav_medinat_chutz',
    usually_has_teudat_zehut: false,
    identity_document: { he: "דרכון + אשרה", en: 'Passport + visa' },
    evidence: [isResidencePermit('א/3', 'ארעי'), foreignResidentClause],
  },

  {
    visa_type: 'a4',
    label: { he: "א/4 · נלווה (קרוב)", en: 'A/4 · Accompanying family member' },
    nohal_category: 'toshav_medinat_chutz',
    usually_has_teudat_zehut: false,
    identity_document: { he: "דרכון + אשרה", en: 'Passport + visa' },
    caveat: {
      he: "⚠️ האשרה נגזרת מהמחזיק העיקרי. אם שלו פגה — גם שלך פגה.",
      en: '⚠️ Your visa derives from the primary holder. If theirs lapses, so does yours.',
    },
    evidence: [
      isResidencePermit('א/4', 'ארעי'),
      foreignResidentClause,
      inferred("התלות באשרת המחזיק העיקרי", 'גיליון F1 מקרה קצה 4 — הנוהל אינו מזכיר א/4'),
    ],
  },

  {
    visa_type: 'a5',
    label: { he: "א/5 · תושב ארעי", en: 'A/5 · Temporary resident' },
    // ⭐⭐ THE HIGHEST-CONSEQUENCE ROW IN THE SYSTEM.
    // He holds a teudat zehut, so the CHANNEL is online. He is still
    // תושב מדינת חוץ, so the CEILING is 176-181. Two axes, and collapsing them
    // would either block a fully eligible person or promise him grades he
    // cannot have. Getting this wrong is the worst output this product can give.
    nohal_category: 'toshav_medinat_chutz',
    usually_has_teudat_zehut: true,
    identity_document: { he: "תעודת זהות + ספח", en: 'Teudat zehut with the attached page' },
    caveat: {
      he: "⚠️ יש לך תעודת זהות — ולכן הערוץ מקוון. אבל הקטגוריה בנוהל היא \"תושב מדינת חוץ\", ולכן תקרת הדרגות היא 176-181. שני דברים נפרדים.",
      en: '⚠️ You hold a teudat zehut, so your channel is online. But your category is still "foreign resident", so your grade ceiling is 176-181. Two separate things.',
    },
    evidence: [
      isResidencePermit('א/5', 'ארעי'),
      foreignResidentClause,
      official(
        'כל-זכות, "המרת רישיון נהיגה זר לרישיון נהיגה ישראלי", עודכן 6.8.2025',
        "אישוש עקיף: תושב ארעי מנוי במפורש ברשימת הזכאים להמרה",
        "עולה חדש, תושב חוזר, תייר ותושב ארעי (לרבות דיפלומטים)",
        'https://www.kolzchut.org.il/he/המרת_רישיון_נהיגה_זר_לרישיון_נהיגה_ישראלי',
      ),
    ],
  },

  {
    visa_type: 'b1',
    label: { he: "ב/1 · עובד זמני", en: 'B/1 · Temporary worker' },
    nohal_category: 'toshav_medinat_chutz',
    usually_has_teudat_zehut: false,
    identity_document: { he: "דרכון + אשרת עבודה", en: 'Passport + work visa' },
    evidence: [isResidencePermit('ב/1', 'ביקור'), foreignResidentClause],
  },

  {
    visa_type: 'b2',
    label: { he: "ב/2 · תייר", en: 'B/2 · Tourist' },
    nohal_category: 'toshav_medinat_chutz',
    usually_has_teudat_zehut: false,
    identity_document: { he: "דרכון + חותמת או אשרה", en: 'Passport + stamp or visa' },
    // ⚠️ The trap Chaya flagged and called "נכונה וקריטית". The window is five
    // years; a visit permit runs up to three months; eligibility is judged at
    // submission. So the REAL deadline is whatever is left on the visa, and a
    // system that shows "four years remaining" is lying to him.
    caveat: {
      he: "⚠️ חלון ההמרה הוא חמש שנים, אבל אשרת ביקור היא עד שלושה חודשים — והזכאות נבחנת ליום ההגשה. בפועל החלון שלך הוא מה שנותר באשרה, לא חמש שנים.",
      en: '⚠️ The conversion window is five years, but a visit permit lasts up to three months, and eligibility is judged on the day you submit. In practice your window is whatever is left on your visa, not five years.',
    },
    evidence: [
      isResidencePermit('ב/2', 'ביקור'),
      foreignResidentClause,
      official(
        'חוק הכניסה לישראל, תשי"ב-1952, ס\' 2(א)(2)',
        "אשרה ורישיון לישיבת ביקור ניתנים עד שלושה חודשים",
        "אשרה ורשיון לישיבת ביקור – עד לשלושה חדשים",
        'https://www.nevo.co.il/law_html/law01/189_003.htm',
      ),
    ],
  },

  {
    visa_type: 'b3',
    label: { he: "ב/3 · נכנס מסופק", en: 'B/3 · Conditional entrant' },
    nohal_category: 'toshav_medinat_chutz',
    usually_has_teudat_zehut: false,
    identity_document: { he: "דרכון + אשרה", en: 'Passport + visa' },
    evidence: [isResidencePermit('ב/3', 'ביקור'), foreignResidentClause],
  },

  {
    visa_type: 'b4',
    label: { he: "ב/4 · מתנדב", en: 'B/4 · Volunteer' },
    nohal_category: 'toshav_medinat_chutz',
    usually_has_teudat_zehut: false,
    identity_document: { he: "דרכון + אשרה", en: 'Passport + visa' },
    evidence: [isResidencePermit('ב/4', 'ביקור'), foreignResidentClause],
  },

  {
    visa_type: 'permanent_resident',
    label: { he: "תושב קבע", en: 'Permanent resident' },
    // ⚠️ Reclassified in גיליון 14 section ה: תושב ישראל, not תושב מדינת חוץ.
    // ס' 1(ב) says "תושב ישראל", not "אזרח ישראלי", so a permanent resident is in.
    nohal_category: 'toshav_israel',
    usually_has_teudat_zehut: true,
    identity_document: { he: "תעודת זהות", en: 'Teudat zehut' },
    caveat: {
      he: "מסלול ההמרה נפתח רק אם שהית שישה חודשים רצופים בחו\"ל אחרי שקיבלת את הרישיון הזר.",
      en: 'The conversion route only opens if you spent six consecutive months abroad after getting your foreign licence.',
    },
    evidence: [
      official(
        'חוק הכניסה לישראל, תשי"ב-1952, ס\' 2(א)(4)',
        "תושב קבע מחזיק אשרה ורישיון לישיבת קבע",
        "אשרה ורשיון לישיבת קבע",
        'https://www.nevo.co.il/law_html/law01/189_003.htm',
      ),
      inferred(
        "הסיווג כתושב ישראל — הנוהל נוקט \"תושב ישראל\" ולא \"אזרח ישראלי\"",
        "נוהל ס' 1(ב) · גיליון 14 סעיף ה",
      ),
    ],
  },

  {
    visa_type: 'citizen',
    label: { he: "אזרח ישראלי", en: 'Israeli citizen' },
    nohal_category: 'toshav_israel',
    usually_has_teudat_zehut: true,
    identity_document: { he: "תעודת זהות", en: 'Teudat zehut' },
    caveat: {
      he: "מסלול ההמרה רלוונטי רק אם שבת מחו\"ל אחרי שישה חודשים רצופים לפחות.",
      en: 'The conversion route is only relevant if you returned after at least six consecutive months abroad.',
    },
    evidence: [
      nohal(
        "ס' 1(ב)",
        "תושב ישראל ששב זכאי להמרה בתוך חמש שנים מהשיבה, בתנאי שישה חודשים רצופים בחו\"ל",
        "תושב ישראל ששהה מחוץ לישראל שישה חודשים רצופים לפחות לאחר קבלת הרישיון הלאומי והגיש את בקשתו בתוך חמש שנים מיום שובו לישראל.",
      ),
    ],
  },

  {
    visa_type: 'diplomat',
    label: { he: "דיפלומט", en: 'Diplomat' },
    // 🔴 The נוהל is silent. כל-זכות says eligible and fee-exempt, but כל-זכות has
    // already been found contradicting the נוהל elsewhere (the entries-and-exits
    // form), so it is not enough to promise anything on.
    nohal_category: 'not_defined_in_nohal',
    usually_has_teudat_zehut: false,
    identity_document: { he: "תעודה דיפלומטית", en: 'Diplomatic card' },
    caveat: {
      he: "הנוהל אינו מזכיר דיפלומטים כלל. כל-זכות מונה אותם כזכאים ואף פטורים מאגרה — אבל זהו מקור משני שכבר נמצא סותר את הנוהל בנושא אחר. כדאי לברר ישירות מול אגף הרישוי.",
      en: 'The procedure does not mention diplomats at all. Kol-Zchut lists them as eligible and fee-exempt, but that is a secondary source already found contradicting the procedure elsewhere. Worth checking directly with the Licensing Division.',
    },
    evidence: [
      unresolved(
        "מעמד הדיפלומטים בנוהל ההמרה — הנוהל שותק, וכל-זכות סותר אותו בנושאים אחרים",
        'גיליון 02 שורה 17',
      ),
    ],
  },

  {
    visa_type: 'section_2a5',
    label: { he: "2(א)(5) · אישור שהייה", en: 'Section 2(a)(5) · Stay permit' },
    nohal_category: 'not_defined_in_nohal',
    usually_has_teudat_zehut: false,
    identity_document: { he: "כרטיס רישיון שהייה", en: 'Stay permit card' },
    caveat: {
      he: "⏳ נכון להיום אין אפשרות להוציא רישיון נהיגה עם אישור שהייה לפי סעיף זה. הנושא תלוי ועומד בבג\"ץ.",
      en: '⏳ As things stand today, a licence cannot be issued on a permit under this section. The matter is before the High Court.',
    },
    evidence: [
      official(
        'חוק הכניסה לישראל, תשי"ב-1952, ס\' 2(א)(5)',
        "לשון החוק מגדירה את המחזיק כמי שנמצא בישראל בלי רישיון ישיבה — וזה בדיוק התנאי שהנוהל דורש",
        "רישיון זמני לישיבת ביקור למי שנמצא בישראל בלי רישיון ישיבה וניתן עליו צו הרחקה – עד ליציאתו מישראל או הרחקתו ממנה.",
        'https://www.nevo.co.il/law_html/law01/189_003.htm',
      ),
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Axis 1 · what each category is entitled to
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORY_RULES: CategoryRuleInput[] = [
  {
    category: 'oleh_chadash',
    label: { he: "עולה חדש", en: 'New immigrant' },
    conversion_window_years: 5,
    window_anchor: 'aliyah',
    // All grades, but 182-185 carry their own extra requirements on top.
    grade_ceiling: { from: 176, to: 185 },
    extra_requirements: [
      {
        he: "לדרגות 182-185 נדרשים גם קורס לנהגי רכב ציבורי/כבד, בדיקות רפואיות, בחינות, ותקנה 189(ד)(3) — אין המרה אוטומטית.",
        en: 'Grades 182-185 also require a professional driver course, medical tests, exams and regulation 189(d)(3). Not an automatic conversion.',
      },
    ],
    evidence: [
      nohal(
        "ס' 1(א)",
        "חלון של חמש שנים מיום העלייה",
        "והגיש את בקשתו בתוך חמש שנים מיום עלייתו.",
      ),
      nohal(
        "ס' 1",
        "תקנה 216 חלה על הדרגות שבתקנות 176 עד 185, ולדרגות הכבדות נדרשים תנאים נוספים",
        "לעניין דרגות נהיגה הקבועות בתקנות 182 עד 185 (E, C, D, D1, D2, D3) נדרש סיום קורס לנהגי רכב ציבורי/כבד, נדרשת עמידה בבדיקות רפואיות ובבחינות, מילוי אחר תקנה 189(ד)(3) וכן שלא התקיים במבקש האמור בתקנה 15ב לתקנות.",
      ),
    ],
  },

  {
    category: 'toshav_israel',
    label: { he: "תושב ישראל ששב מחו\"ל", en: 'Israeli resident returning from abroad' },
    conversion_window_years: 5,
    window_anchor: 'return',
    grade_ceiling: { from: 176, to: 185 },
    extra_requirements: [
      {
        // ⚠️ Consecutive, not cumulative. Someone who spent six months abroad
        // across three trips does not enter this category at all.
        he: "⚠️ שישה חודשים רצופים לפחות בחו\"ל, אחרי קבלת הרישיון הלאומי. רצופים — לא במצטבר.",
        en: '⚠️ At least six CONSECUTIVE months abroad, after receiving your national licence. Consecutive, not cumulative.',
      },
      {
        he: "נדרש טופס כניסות ויציאות ממשרד הפנים. זו הקטגוריה היחידה שנדרשת בו.",
        en: 'An entries-and-exits form from the Interior Ministry is required. This is the only category that needs it.',
      },
    ],
    evidence: [
      nohal(
        "ס' 1(ב)",
        "חמש שנים מיום השיבה, בתנאי שישה חודשים רצופים בחו\"ל אחרי קבלת הרישיון",
        "תושב ישראל ששהה מחוץ לישראל שישה חודשים רצופים לפחות לאחר קבלת הרישיון הלאומי והגיש את בקשתו בתוך חמש שנים מיום שובו לישראל.",
      ),
    ],
  },

  {
    category: 'toshav_medinat_chutz',
    label: { he: "תושב מדינת חוץ", en: 'Foreign resident' },
    conversion_window_years: 5,
    window_anchor: 'entry',
    // ⭐ The ceiling. Not a technical limit — an entitlement limit. There is no
    // conversion to bus (D) or heavy truck (C, E) under any conditions.
    grade_ceiling: { from: 176, to: 181 },
    extra_requirements: [
      {
        he: "רישיון הישיבה חייב להיות בתוקף ביום ההגשה — לא רק ביום הכניסה.",
        en: 'Your residence permit must be valid on the day you submit, not merely on the day you entered.',
      },
      {
        he: "⚠️ תקרת הדרגות היא 176-181. אין מסלול המרה לאוטובוס (D) או למשאית כבדה (C, E) בשום תנאי.",
        en: '⚠️ The ceiling is regulations 176-181. There is no conversion route to bus (D) or heavy truck (C, E) under any conditions.',
      },
    ],
    evidence: [foreignResidentClause],
  },

  {
    category: 'not_defined_in_nohal',
    label: { he: "לא מוגדר בנוהל", en: 'Not defined in the procedure' },
    extra_requirements: [
      {
        he: "הנוהל אינו מתייחס למעמד הזה. אנחנו לא יודעים מה חל עליך — כדאי לברר ישירות מול אגף הרישוי, 02-6663050.",
        en: 'The procedure does not address this status. We do not know what applies to you. Worth checking directly with the Licensing Division, 02-6663050.',
      },
    ],
    evidence: [
      {
        claim: "הנוהל מגדיר שלוש קטגוריות בלבד, ומעמדות מסוימים אינם נופלים באף אחת מהן",
        certainty: 'unchecked',
        last_verified_at: LAST_VERIFIED,
        variation_factors: [],
      },
    ],
  },
];
