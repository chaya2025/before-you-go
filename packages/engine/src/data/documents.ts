import type { RequiredDocumentInput } from '../domain';
import type { Condition } from '../condition';
import { nohal, servicePage, fieldReport, notChecked } from './sources';

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

export const DOCUMENTS: RequiredDocumentInput[] = [
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
      he: "דף A4 מודפס — מסמך נפרד שאפשר לאבד, לא חותמת בדרכון. ⚠️ המספר משמש אך ורק במשרד הרישוי: לא בביטוח לאומי, לא ברשות האוכלוסין, ולא בקופת חולים.",
      en: 'A printed A4 sheet, a separate document you can lose, not a stamp in your passport. ⚠️ The number is used only at the licensing office: not at National Insurance, the Population Authority, or your health fund.',
    },
    evidence: [
      servicePage(
        "הוצאת רישיון נהיגה לעובד זר",
        "משרד הרישוי מנפיק מספר זיהוי המתחיל ב-89",
        "במשרד הרישוי יונפק מספר זיהוי פיקטיבי המתחיל בספרות 89.",
      ),
      fieldReport("המסמך הוא דף A4 מודפס, והמספר משמש רק במשרד הרישוי"),
    ],
  },

  {
    id: 'doc.record',
    name: { he: "\"רקורד\" ממדינת המוצא", en: 'The "record" from your home country' },
    applies_when: CONVERTING,
    issued_by: { he: "גורם מוסמך במדינת המוצא", en: 'A competent authority in your home country' },
    // ⭐ Not an original, and this is the one piece of good news in the whole
    // conversion route: it can be started remotely, today, by email.
    must_be_original: false,
    accepts_email: true,
    notes: {
      he: "נדרש רק למי שרוצה פטור ממבחן שליטה ומבדיקת ראייה. מתקבל בדוא\"ל, אז אפשר להתחיל מרחוק היום. ⚠️ חייב לציין את מועד הוצאת הרישיון הקבוע — לא את מועד הנפקת הכרטיס הנוכחי.",
      en: 'Only needed if you want exemption from the control test and eye test. Accepted by email, so you can start remotely today. ⚠️ It must state when your PERMANENT licence was issued, not when your current card was printed.',
    },
    evidence: [
      nohal(
        "פרק \"מסמכים נדרשים\" — מופיע בשלוש הרשימות",
        "אסמכתה מגורם מוסמך במדינת המוצא על מועד הוצאת הרישיון הקבוע, מתקבלת בדוא\"ל",
        "רקורד - למעוניינים בקבלת פטור ממבחן שליטה ובדיקת ראיה (בעלי רישיון נהיגה לאומי קבוע במשך חמש שנים לפחות, כאמור) נדרש להציג אסמכתה מגורם מוסמך ממדינת המוצא המציינת את מועד הוצאת רישיון הנהיגה הקבוע (ניתן גם באמצעות דוא\"ל).",
      ),
      // ⚠️ Open question 16, and the biggest practical blocker in this route.
      // The founder has never seen one, which is exactly why the POC asks a yes/no
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
    applies_when: CONVERTING,
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

  {
    id: 'doc.payment_receipt',
    name: { he: "אישור תשלום אגרה", en: 'Proof of fee payment' },
    applies_when: { field: 'track', op: 'eq', value: 'from_zero' },
    issued_by: { he: "שירות התשלומים הממשלתי או סניף דואר", en: 'The government payment service or a post office' },
    must_be_original: false,
    notes: {
      he: "חובה להביא לטסט. כדאי לשמור צילום של כל אישור תשלום לאורך התהליך.",
      en: 'Required at the test. Worth keeping a photo of every payment receipt through the process.',
    },
    evidence: [
      servicePage(
        "מה להביא למבחן המעשי (טסט)",
        "אישור על תשלום האגרה נדרש בטסט",
        "תעודת זהות, דרכון או רישיון נהיגה · אישור על תשלום האגרה · משקפיים או עדשות מגע, אם יש צורך.",
      ),
    ],
  },

  {
    id: 'doc.glasses',
    name: { he: "משקפיים או עדשות מגע", en: 'Glasses or contact lenses' },
    applies_when: { field: 'track', op: 'eq', value: 'from_zero' },
    issued_by: { he: "—", en: '—' },
    must_be_original: false,
    notes: {
      he: "רק למי שמרכיב. \"אם יש צורך\" — לא חובה גורפת.",
      en: 'Only if you wear them. "If needed" — not a blanket requirement.',
    },
    evidence: [
      servicePage(
        "מה להביא למבחן המעשי (טסט)",
        "משקפיים או עדשות נדרשים רק למי שמרכיב",
        "משקפיים או עדשות מגע, אם יש צורך.",
      ),
    ],
  },
];
