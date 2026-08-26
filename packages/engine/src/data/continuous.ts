import type { ContinuousConditionInput } from '../domain';
import type { Condition } from '../condition';
import { nohal, servicePage, fieldReport, inferred, LAST_VERIFIED_LATE } from './sources';

/**
 * ============================================================================
 * CONTINUOUS CONDITIONS — the finding Chaya calls the most important
 * ============================================================================
 *
 * גיליון 13, on the continuous_condition entity:
 *   "תנאי שחייב להתקיים בכל שלב — לא רק בהגשה הראשונה.
 *    זו התובנה החשובה ביותר מהמקרה."
 *
 * And principle 14 says why a simple list cannot hold it:
 *   "רומדמאפ אינו רשימה — הוא גרף עם תנאים מתמשכים. שלב שהושלם יכול להתבטל
 *    בשקט. ויזה שפגה או דרכון שחודש מפילים שלבים שכבר עברת."
 *
 * ⚠️ The word that matters is בשקט. Nothing tells you. You find out at the desk,
 * or at the test, which is the most expensive possible moment to find out.
 *
 * POC scope note (גיליון F0): with nothing saved between visits, these cannot
 * fire as proactive alerts. At POC they render as a standing warning at the top
 * of the roadmap and as a checklist before every physical visit. At MVP, once
 * there is state, they become real alerts.
 */

const NO_TEUDAT_ZEHUT: Condition = { field: 'has_teudat_zehut', op: 'eq', value: false };
const CONVERTING: Condition = { field: 'track', op: 'eq', value: 'conversion' };

export const CONTINUOUS_CONDITIONS: ContinuousConditionInput[] = [
  {
    id: 'cc.visa_valid',
    name: { he: "האשרה חייבת להיות בתוקף — בכל פעולה, לא רק בהתחלה", en: 'Your visa must be valid at every step, not just the first' },
    applies_when: NO_TEUDAT_ZEHUT,
    check_before: [
      'fz.doc_89',
      'fz.photo_and_eye',
      'fz.test',
      'fz.permit_in_person',
      'fz.completion_in_person',
      'cv.doc_89',
      'cv.attend',
    ],
    consequence_if_invalid: {
      // ⭐ Widened 2026-08-25. This is not a licensing-office rule. Chaya:
      // "if someone's visa is not valid, then you can't do anything from the
      // government with a visa that's expired. For example Bituach Leumi or
      // driving test or anything like that."
      // That reframes it from a quirk of משרד הרישוי into how the state works,
      // which is why the generalisability is 'pattern' rather than one report.
      he: "אשרה שפגה חוסמת כל פעולה מול הרשויות — לא רק במשרד הרישוי. הפקיד בודק, והמערכת חוסמת. כל עוד האשרה אינה בתוקף, שום שלב בתהליך לא יתקדם, כולל עדכון מסמך ה-89.",
      en: 'An expired visa blocks every dealing with the authorities, not only the licensing office. The clerk checks and the system blocks. While it is not valid, no step moves forward, including updating your 89 document.',
    },
    remedy: {
      // ⚠️ The three-day case is deliberately not here. It happened, it was luck
      // with one clerk, and it is not reproducible — so under principle 21 it is
      // an anecdote, not a rule. Including it would let someone plan around it.
      he: "חדש את האשרה לפחות חודש מראש. החידוש מקוון ואורך כחודש.",
      en: 'Renew your visa at least a month in advance. Renewal is online and takes about a month.',
    },
    evidence: [
      nohal(
        "ס' 1(ג)",
        "הזכאות נבחנת לרגע ההגשה — נדרש רישיון ישיבה בתוקף בעת הגשת הבקשה",
        "תושב מדינת חוץ שהגיש את בקשתו בעת שהיה ברשותו רישיון ישיבה בישראל.",
      ),
      // ⭐ Upgraded in גיליון 14 item 3. The clerk checked and the SYSTEM blocked,
      // which means this is not clerk discretion — so it generalises.
      fieldReport(
        "הפקידה בדקה ואז המערכת חסמה — חסימת מערכת ולא שיקול דעת פקיד, ולכן סבירות ההכללה גבוהה מאוד",
        { generalizability: 'corroborated' },
      ),
      // ⭐ Widened 2026-08-25: this is a general property of dealing with the
      // Israeli state, not something specific to licensing. 'pattern' is the
      // highest generalisability in the model, and this is the first claim in
      // the system to earn it.
      fieldReport(
        "אשרה שאינה בתוקף חוסמת כל התנהלות מול רשויות המדינה — ביטוח לאומי, משרד הרישוי, וכל השאר. זהו כלל כללי ולא מגבלה של משרד הרישוי",
        { generalizability: 'pattern', last_verified_at: LAST_VERIFIED_LATE },
      ),
      fieldReport("חידוש אשרה מתבצע מקוון ואורך חודש לפחות", {
        varies_by: ['clerk_discretion'],
      }),
    ],
  },

  {
    id: 'cc.passport_number_match',
    name: {
      he: "מספר הדרכון במסמך ה-89 חייב לתאום לדרכון שבידך",
      en: 'The passport number on your 89 document must match the passport you hold',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    check_before: ['fz.photo_and_eye', 'fz.test', 'fz.permit_in_person', 'cv.attend'],
    consequence_if_invalid: {
      // ⚠️ The most expensive trap in the research. Not "you are turned away" —
      // the test is RECORDED AS A FAILURE, with the fee paid and the wait wasted.
      he: "⚠️ אי-התאמה מונעת את קיום הטסט, והוא נרשם ככישלון מלא — לא כ\"לא התייצב\". שילמת אגרה, המתנת, ונרשם לך כישלון על מבחן שלא התקיים. אפשר לערער, אבל הערעור חוסם הרשמה לטסט חדש עד שהוא מסתיים.",
      en: '⚠️ A mismatch stops the test from happening, and it is recorded as a full failure, not as "did not attend". You paid the fee, you waited, and a failure is registered for a test that never took place. You can appeal, but appealing blocks you from booking a new test until it concludes.',
    },
    remedy: {
      he: "חידשת דרכון? קבע תור למשרד הרישוי ועדכן את מסמך ה-89 לפני הטסט. ⚠️ מספר ה-89 עצמו קבוע ואינו משתנה — מעדכנים רק את הקישור לדרכון החדש. שים לב: העדכון מחייב תור, בניגוד להנפקה הראשונה.",
      en: 'Renewed your passport? Book a licensing office appointment and update the 89 document before your test. ⚠️ The 89 number itself never changes; only its link to the passport is updated. Note this update DOES require an appointment, unlike the first issue.',
    },
    evidence: [
      fieldReport(
        "אי-התאמה בין מספר הדרכון שבמסמך ה-89 לדרכון שברשות הנבחן מונעת את קיום הטסט, והוא נרשם ככישלון",
      ),
      fieldReport(
        "מספר ה-89 עצמו קבוע — חידוש דרכון שובר רק את הקישור, והעדכון מחייב תור",
        { generalizability: 'corroborated' },
      ),
    ],
  },

  {
    id: 'cc.foreign_license_valid',
    name: {
      he: "הרישיון הזר חייב להיות בתוקף ביום ההגשה",
      en: 'Your foreign licence must be valid on the day you submit',
    },
    applies_when: CONVERTING,
    check_before: ['cv.attend', 'cv.control_test'],
    consequence_if_invalid: {
      he: "רישיון זר שפג אינו כשיר להמרה — גם אם החזקת בו עשרים שנה. \"בתוקף\", לא \"קיים\".",
      en: 'An expired foreign licence cannot be converted, even after twenty years of holding it. The word is "valid", not "held".',
    },
    remedy: {
      // A real scenario, not a hypothetical: the רקורד takes months, and the
      // licence can expire while he waits for it.
      he: "אם הרישיון עומד לפוג בזמן שאתה ממתין לרקורד — חדש אותו במדינת המוצא במקביל, ואל תחכה שהתהליך כאן יסתיים.",
      en: 'If your licence is due to expire while you wait for the record, renew it in your home country in parallel. Do not wait for the process here to finish.',
    },
    evidence: [
      nohal(
        "פרק \"מסמכים נדרשים\"",
        "נדרש רישיון נהיגה לאומי בתוקף",
        "רישיון נהיגה לאומי בתוקף.",
      ),
      inferred(
        "הרישיון עלול לפוג בזמן ההמתנה לרקורד, שאורכת חודשים",
        'גיליון F2 מקרה קצה 2 — הסקה משני תנאים מצוטטים',
      ),
    ],
  },

  {
    id: 'cc.english_name_match',
    name: {
      he: "השם באנגלית חייב להיות מעודכן ברשות האוכלוסין",
      en: 'Your name in English must be up to date at the Population Authority',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    check_before: ['fz.online_form', 'cv.online_form'],
    consequence_if_invalid: {
      he: "אי-התאמה בין הדרכון לרישום ברשות האוכלוסין עוצרת את התהליך.",
      en: 'A mismatch between your passport and the Population Authority registry stalls the process.',
    },
    remedy: {
      he: "עדכן את השם באנגלית ברשות האוכלוסין לפני שאתה ממלא את הטופס.",
      en: 'Update your name in English at the Population Authority before filling in the form.',
    },
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "נדרש שהשם יהיה מעודכן באנגלית ברשות האוכלוסין",
        "יש לוודא כי שמם של מגישי הבקשה מעודכן בשפה האנגלית ברשות האוכלוסין וההגירה.",
      ),
      // 📏 כלל הודאות: the requirement is 🟢, the "must match the passport" part
      // is 🟡, and the system acts on the matching — so this reads 🟡.
      inferred(
        "שהכתיב חייב להיות זהה לדרכון — הדף דורש עדכון, לא התאמה",
        'גיליון 03 שורה 3 · גיליון 05 שורה 13',
      ),
    ],
  },

  {
    id: 'cc.address_registered',
    name: {
      he: "כתובת מעודכנת ברשות האוכלוסין",
      en: 'A current address at the Population Authority',
    },
    applies_when: { always: true },
    check_before: ['fz.receive_card', 'cv.receive'],
    consequence_if_invalid: {
      he: "הרישיון הקבוע נשלח לכתובת המעודכנת ברשות האוכלוסין. בלי כתובת רשומה — הוא לא יגיע.",
      en: 'The permanent licence is posted to the address registered with the Population Authority. With no registered address, it will not arrive.',
    },
    remedy: {
      // The choice of delivery method exists only in the duplicate route.
      // On first issue it is posted, and open question 9 covers whether it can
      // be collected instead.
      he: "עדכן כתובת ברשות האוכלוסין. אין לך כתובת רשומה? אנחנו לא יודעים אם אפשר לאסוף את הרישיון בסניף. במסלול הפקת כפל אפשר לבחור איסוף עצמי בדפוס בארי — חינם, ובלי כתובת.",
      en: 'Register an address with the Population Authority. No registered address? We do not know whether the licence can be collected at a branch. In the duplicate route you can choose self-collection at Defus Bari — free, and no address needed.',
    },
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "הרישיון הקבוע נשלח לכתובת המעודכנת ברשות האוכלוסין",
        "רישיון נהיגה קבוע (פלסטיק) יישלח לכתובת המעודכנת ברשות האוכלוסין.",
      ),
      fieldReport("איסוף עצמי בדפוס בארי אינו תלוי בכתובת רשומה", { generalizability: 'single_report' }),
    ],
  },
];
