import type { StepInput } from '../domain';
import type { Condition } from '../condition';
import { nohal, servicePage, official, fieldReport, inferred, notChecked, LAST_VERIFIED_LATE } from './sources';

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
const EXEMPT_FROM_TESTS: Condition = {
  all: [
    { field: 'foreign_license_years', op: 'gte', value: 5 },
    { field: 'has_record_document', op: 'eq', value: 'yes' },
    { field: 'requested_class', op: 'in', value: ['A2', 'A1', 'A', '1', 'B'] },
  ],
};

export const CONVERSION_STEPS: StepInput[] = [
  {
    id: 'cv.record',
    track: 'conversion',
    title: { he: "השגת \"רקורד\" ממדינת המוצא", en: 'Get your "record" from your home country' },
    action: {
      he: "בקש מהרשות המוסמכת במדינת המוצא אסמכתה המציינת את המועד שבו הוצא לך רישיון הנהיגה הקבוע. מתקבל גם בדוא\"ל — אפשר להתחיל מרחוק היום.",
      en: 'Ask the competent authority in your home country for a document stating when your permanent licence was issued. Email is accepted, so you can start this remotely today.',
    },
    applies_when: EVERYONE,
    // ⭐ Needed at the END, started on DAY ONE. גיליון 13 principle 3:
    // "אם מציגים אותו בסוף — המשתמש כבר איחר."
    sequence_position: 1,
    act_when: 'start_now',
    lead_time_days: 60,
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

  {
    id: 'cv.english_name',
    track: 'conversion',
    title: { he: "עדכון השם באנגלית ברשות האוכלוסין", en: 'Update your name in English' },
    action: {
      he: "ודא שהשם שלך מעודכן באנגלית ברשות האוכלוסין, בכתיב זהה לדרכון.",
      en: 'Make sure your name is registered in English at the Population Authority, spelled as in your passport.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 2,
    act_when: 'start_now',
    channel: 'population_authority',
    authority: "רשות האוכלוסין וההגירה",
    links: [{ label: { he: "רשות האוכלוסין", en: 'Population and Immigration Authority' }, url: 'https://www.gov.il/he/departments/population_and_immigration_authority' }],
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "נדרש שהשם יהיה מעודכן באנגלית ברשות האוכלוסין",
        "יש לוודא כי שמם של מגישי הבקשה מעודכן בשפה האנגלית ברשות האוכלוסין וההגירה.",
      ),
      // 📏 כלל הודאות: requirement 🟢, the matching-the-passport part 🟡, so 🟡.
      inferred(
        "הכתיב חייב להיות זהה לדרכון — הדף דורש עדכון, לא התאמה",
        'גיליון 03 שורה 3 · גיליון 05 שורה 13',
      ),
    ],
  },

  {
    id: 'cv.doc_89',
    track: 'conversion',
    title: { he: "הוצאת מספר מזהה 89", en: 'Get your 89 identity number' },
    action: {
      he: "הגע למשרד הרישוי עם דרכון מקורי ואשרת שהייה בתוקף וקבל מספר מזהה שמתחיל ב-89.",
      en: 'Go to a licensing office with your original passport and valid visa and get an identity number starting with 89.',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    sequence_position: 3,
    act_when: 'start_now',
    channel: 'licensing_office',
    authority: "משרד הרישוי",
    requires_appointment: false,
    requires_documents: ['doc.passport', 'doc.visa'],
    links: [{ label: { he: "זימון תור למשרד הרישוי", en: 'Book a licensing office appointment' }, url: 'https://www.gov.il/he/Departments/General/govisit' }],
    fallback: {
      he: "לך בלי תור. אם דוחים אותך — קבע תור באותו רגע, במקום.",
      en: 'Go without an appointment. If they turn you away, book one there and then.',
    },
    evidence: [
      servicePage(
        "הוצאת רישיון נהיגה לעובד זר",
        "משרד הרישוי מנפיק מספר זיהוי המתחיל ב-89",
        "במשרד הרישוי יונפק מספר זיהוי פיקטיבי המתחיל בספרות 89.",
      ),
      fieldReport("להנפקה הראשונה אין צורך בתור מראש. כל ביקור אחר מחייב תור", {
        varies_by: ['branch'],
      }),
      // ⭐ Open question 20, answered by Chaya 25.8. The נוהל never mentions the
      // 89 number, but the reason is not that it is optional here — it is that
      // the נוהל describes eligibility, not identification. Every Israeli driver
      // needs an identifying number; without a teudat zehut that number is an 89,
      // and it is the first stop on BOTH tracks.
      fieldReport(
        "כל נהג בישראל חייב מספר מזהה. מי שאין לו תעודת זהות מקבל מספר 89, וזה נכון גם במסלול ההמרה — זו התחנה הראשונה, אף שהנוהל אינו מזכיר זאת",
        { generalizability: 'pattern', last_verified_at: LAST_VERIFIED_LATE },
      ),
      // ⭐ The strongest hint that the נוהל was written for people without an ID.
      nohal(
        "פרק \"מסמכים נדרשים\" ← \"תושב מדינת חוץ\"",
        "רשימת המסמכים לתושב מדינת חוץ אינה כוללת תעודת זהות כלל",
        "רישיון נהיגה לאומי בתוקף. דרכון עם אשרת שהייה בתוקף.",
      ),
    ],
  },

  {
    id: 'cv.entry_exit_form',
    track: 'conversion',
    title: { he: "טופס כניסות ויציאות", en: 'Entries and exits form' },
    action: {
      he: "הוצא טופס כניסות ויציאות מרשות האוכלוסין. הראשון ביום — חינם.",
      en: 'Get an entries-and-exits form from the Population Authority. The first one each day is free.',
    },
    // ⚠️ ONLY תושב ישראל ששב. כל-זכות demands it from everyone and contradicts
    // the נוהל; the נוהל wins. A תושב מדינת חוץ is not merely exempt from this —
    // he is not entitled to request it at all.
    applies_when: { field: 'nohal_category', op: 'eq', value: 'toshav_israel' },
    sequence_position: 4,
    channel: 'population_authority',
    authority: "רשות האוכלוסין",
    links: [{ label: { he: "בירור פרטים על נוסע", en: 'Entries and exits enquiry' }, url: 'https://www.gov.il/he/service/inquiry_of_exit_and_entery_from_israel' }],
    cost: {
      amount_ils: 0,
      note: { he: "בקשה נוספת באותו יום — 20 ₪.", en: 'A second request on the same day costs 20 ILS.' },
      evidence: [
        official(
          'דף השירות "בירור פרטים על נוסע", רשות האוכלוסין',
          "הראשון ביום חינם, נוסף באותו יום 20 ₪",
          "השירות ניתן ללא עלות (עבור בקשה אחת ליום).",
          'https://www.gov.il/he/service/inquiry_of_exit_and_entery_from_israel',
        ),
      ],
    },
    evidence: [
      nohal(
        "פרק \"מסמכים נדרשים\" ← \"תושב ישראל ששהה בחו\"ל לפחות 6 חודשים\", ס' 3",
        "הטופס נדרש רק מתושב ישראל ששב, ואינו מופיע ברשימות עולה חדש ותושב מדינת חוץ",
        "טופס כניסות ויציאות ממשרד הפנים.",
      ),
    ],
  },

  {
    id: 'cv.translation',
    track: 'conversion',
    title: { he: "תרגום מסמכים שאינם באנגלית", en: 'Translate documents that are not in English' },
    action: {
      he: "רשות הרישוי רשאית לדרוש תרגום של הרישיון הלאומי או של כל מסמך אחר שאינו באנגלית. התרגום מתבצע על ידי עו\"ד או נוטריון דובר השפה.",
      en: 'The licensing authority may require a translation of your licence or any other document not in English, done by a lawyer or notary who speaks the language.',
    },
    applies_when: EVERYONE,
    sequence_position: 5,
    channel: 'unknown',
    authority: "עו\"ד או נוטריון",
    evidence: [
      // ⚠️ "רשאית לדרוש" is an authority, not an obligation. The system may never
      // tell someone "you must get a translation" — only that it may be required.
      nohal(
        "פרק \"הערות\", תבליט 4",
        "רשות הרישוי רשאית לדרוש תרגום — סמכות, לא חובה אוטומטית",
        "רשות הרישוי רשאית לדרוש תרגום של רישיון הנהיגה הלאומי, ו/או כל מסמך הנדרש לצורך המרת רישיון (מלבד אנגלית) התרגום יתבצע ע\"י עו\"ד/נוטריון דובר השפה.",
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
    sequence_position: 6,
    must_come_after: ['cv.doc_89'],
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
    ],
  },

  {
    id: 'cv.photo',
    track: 'conversion',
    title: { he: "תחנת צילום", en: 'Photo station' },
    action: {
      he: "אחרי מילוי הטופס, גש לאחת מתחנות הצילום עם תעודה מזהה והצטלם. הצילום חינם.",
      en: 'After submitting the form, go to a photo station with photo ID. The photo is free.',
    },
    applies_when: EVERYONE,
    sequence_position: 7,
    must_come_after: ['cv.online_form'],
    channel: 'photo_station',
    links: [{ label: { he: "תחנות צילום", en: 'Photo stations' }, url: 'https://www.gov.il/he/service/drivers_license_photo_stations' }],
    evidence: [
      nohal(
        "פרק \"התהליך\"",
        "הצילום בא אחרי הטופס המקוון, עם תעודת זהות או דרכון",
        "לאחר מילוי הטופס הנ\"ל יש לגשת לאחת מתחנות הצילום עם תעודה מזהה (תעודת זהות/דרכון) ולהצטלם.",
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
    sequence_position: 8,
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
    ],
  },

  {
    id: 'cv.book_appointment',
    track: 'conversion',
    title: { he: "זימון תור למשרד הרישוי", en: 'Book a licensing office appointment' },
    action: { he: "קבע תור לסניף משרד הרישוי דרך GoVisit.", en: 'Book an appointment at a licensing office branch through GoVisit.' },
    applies_when: EVERYONE,
    sequence_position: 9,
    channel: 'online',
    requires_appointment: true,
    links: [{ label: { he: "GoVisit — זימון תור", en: 'GoVisit appointment booking' }, url: 'https://www.gov.il/he/Departments/General/govisit' }],
    evidence: [
      nohal(
        "פרק \"התהליך\"",
        "התור נקבע דרך GoVisit, והקישור מופיע בנוהל עצמו",
        "לקבוע תור לסניף משרד הרישוי ולגשת באופן אישי עם המסמכים הדרושים.",
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
    sequence_position: 10,
    must_come_after: ['cv.book_appointment'],
    channel: 'licensing_office',
    requires_appointment: true,
    /**
     * ⭐⭐ THE ONE VISIT WHERE HE HANDS EVERYTHING OVER, and it was asking for
     * three documents out of nine.
     *
     * ⚠️ Found 30.8 by a coverage sweep, after Chaya asked for a critical pass
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
    requires_documents: [
      'doc.identity',
      'doc.passport',
      'doc.visa',
      'doc.form_89',
      'doc.foreign_license',
      'doc.record',
      'doc.translation',
      'doc.entry_exit_form',
      'doc.teudat_oleh',
    ],
    links: [{ label: { he: "הנוהל המלא", en: 'The full procedure' }, url: 'https://www.gov.il/he/pages/1961' }],
    checklist: [
      { he: "האשרה בתוקף היום? הזכאות נבחנת לרגע ההגשה.", en: 'Is your visa valid TODAY? Eligibility is judged at the moment you submit.' },
      { he: "הרישיון הזר בתוקף — לא רק קיים?", en: 'Is your foreign licence valid, not merely in your possession?' },
      { he: "כל המסמכים במקור?", en: 'Are all documents originals?' },
      { he: "הרקורד הגיע?", en: 'Has the record arrived?' },
    ],
    evidence: [
      nohal(
        "פרק \"התהליך\"",
        "הנוהל מגדיר הגעה פרונטלית עם המסמכים",
        "לקבוע תור לסניף משרד הרישוי ולגשת באופן אישי עם המסמכים הדרושים.",
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
    title: { he: "בדיקה ואימות המסמכים", en: 'Document check and verification' },
    action: {
      he: "רשות הרישוי בודקת ומאמתת את המסמכים על פי שיקול דעתה, וככל הניתן בתוך 14 ימי עבודה. ⚠️ זהו יעד רך ולא התחייבות.",
      en: 'The licensing authority checks and verifies your documents at its discretion, as far as possible within 14 working days. ⚠️ That is a soft target, not a commitment.',
    },
    applies_when: EVERYONE,
    sequence_position: 11,
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
    applies_when: { not: EXEMPT_FROM_TESTS },
    sequence_position: 12,
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
    id: 'cv.medical_c1',
    track: 'conversion',
    title: { he: "בדיקות רפואיות לדרגה C1", en: 'Medical tests for grade C1' },
    action: { he: "עבור את הבדיקות הרפואיות הקבועות בתקנות.", en: 'Complete the medical tests set out in the regulations.' },
    applies_when: { field: 'requested_class', op: 'eq', value: 'C1' },
    sequence_position: 13,
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
        "הרישיון הקבוע נשלח לכתובת המעודכנת ברשות האוכלוסין.\n\n" +
        "⚠️ הנוהל אינו מתאר את שלב המסירה בהמרה כלל, ואיש לא דיווח לנו איך הוא עובד בפועל. ככל הנראה זה עובד כמו במסלול מאפס — אבל אין לנו ודאות.",
      en:
        'The permanent licence is posted to the address registered with the Population Authority.\n\n' +
        '⚠️ The procedure does not describe this stage for conversion at all, and nobody has reported to us how it works in practice. It most likely works as it does on the from-scratch route, but we are not certain.',
    },
    applies_when: EVERYONE,
    sequence_position: 14,
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
      // ⚠️ Read cover to cover. The נוהל ends at the document list and the notes.
      // Not one word about a temporary licence, a plastic card, post, or delivery.
      notChecked(
        "הנוהל אינו מתאר את שלב המסירה בהמרה כלל — מה שידוע מגיע ממסלול מאפס, שהוא מסלול אחר",
      ),
      // ⭐ Chaya's call, 25.8: assume it works like the from-zero route, and flag
      // it. 🟡 rather than ⬜ because there IS a reason — delivery depends on
      // IDENTIFICATION, and identification does not change between tracks. If the
      // online channel needs a national ID, it needs one here too.
      //
      // ⚠️ But it has never been observed on this route. Her words: "most probably
      // that's how you do it, but not for sure. There's no ודאות for this."
      inferred(
        "ככל הנראה המסירה עובדת כמו במסלול מאפס — כלומר למי שאין תעודת זהות היא פיזית ולא מקוונת. הבסיס: המסירה תלויה בזיהוי, והזיהוי אינו משתנה בין המסלולים. ⚠️ לא נצפה בפועל באף מקרה של המרה",
        'הסקה בין-מסלולית · שאלה 23 · לא אומת',
      ),
      // ⭐ Chaya said a converter with under two years on his foreign licence is
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
      // ⭐ Chaya, 25.8: "doesn't matter if you have an 89 or you're a citizen —
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
