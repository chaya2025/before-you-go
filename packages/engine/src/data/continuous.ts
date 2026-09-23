import type { ContinuousConditionInput } from '../domain';
import type { Condition } from '../condition';
import { nohal, servicePage, fieldReport, inferred, unresolved, notChecked, LAST_VERIFIED_LATE } from './sources';

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
    /**
     * ⭐ WIDENED 30.8, BY CHAYA, and the reasoning is the one this whole engine
     * runs on.
     *
     * It used to be NO_TEUDAT_ZEHUT, which meant an א/5 was never asked about
     * his visa at all — he holds a teudat zehut, so the condition skipped him.
     *
     * ⚠️ But an א/5 is a TEMPORARY resident and his card is issued AGAINST that
     * visa, not independently of it. If the visa lapses it is not obvious the
     * card keeps working, and if it does not, this condition was silently
     * exempting precisely the person most likely to be caught out. א/5 is
     * already flagged in eligibility.ts as the highest-consequence row in the
     * system, because his channel and his ceiling come apart.
     *
     * Her call, in her words: "consider it like anyone who doesn't have an ID.
     * better flagging than ignoring it."
     *
     * ⭐ That is the same asymmetry as everywhere else here: showing a check
     * that may not apply costs him a glance. Hiding one that does apply costs
     * him a blocked process he cannot see the reason for.
     *
     * ⚠️ The scope is nohal_category, NOT the visa code. א/5 is not a special
     * case — the property that matters is being a foreign resident whose
     * status rests on a permit. Anyone reclassified into that category inherits
     * the check automatically.
     *
     * ⬜ STILL OPEN, and the evidence below says so: does an א/5 teudat zehut
     * remain usable at the licensing desk once the אשרה behind it has expired?
     * אגף הרישוי 02-6663050. The widening is a deliberate choice under
     * uncertainty, not a verified rule, and it is marked as one.
     */
    applies_when: {
      any: [
        NO_TEUDAT_ZEHUT,
        { field: 'nohal_category', op: 'eq', value: 'toshav_medinat_chutz' },
      ],
    },
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
      // ⬜ The widening itself, marked as the open question it is rather than
      // dressed up as a rule. Chaya chose to flag rather than ignore; nobody
      // has yet confirmed what the desk does.
      unresolved(
        "התנאי הורחב גם למי שמחזיק תעודת זהות ארעית (א/5), מתוך הנחה שהתעודה נשענת על האשרה",
        'שאלה פתוחה — לא אומת מול אגף הרישוי',
      ),
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
      he: "⚠️ אי-התאמה מונעת את קיום הטסט, והוא נרשם ככישלון מלא ולא כ\"לא התייצב\", למרות שהמבחן לא התקיים. ניתן לערער, אך הערעור חוסם הרשמה לטסט חדש עד להכרעתו.",
      en: '⚠️ A mismatch prevents the test from taking place, and it is recorded as a full failure rather than "did not attend", even though the test never happened. You can appeal, but an appeal blocks you from booking a new test until it is decided.',
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
    /**
     * ⭐ 23.9, Chaya: this is the ONLY place the English name is said. The two
     * steps that repeated it (`fz.english_name`, `cv.english_name`) were
     * deleted, because most people are already registered correctly and a task
     * they cannot act on reads as a thing they have failed to do. Her rule:
     * "a saying and a reminder, not a full step that has to be completed,
     * because it really doesn't apply to everyone." So the wording below tells
     * him what must be true, and what to do ONLY IF he has reason to doubt it.
     */
    name: {
      he: "השם באנגלית ברשות האוכלוסין חייב להיות זהה לדרכון",
      en: 'Your name in English at the Population Authority must match your passport',
    },
    applies_when: NO_TEUDAT_ZEHUT,
    check_before: ['fz.online_form', 'cv.online_form'],
    consequence_if_invalid: {
      he: "אי-התאמה בין הדרכון לרישום ברשות האוכלוסין עוצרת את התהליך.",
      en: 'A mismatch between your passport and the Population Authority registry stalls the process.',
    },
    remedy: {
      he: "אצל רוב האנשים השם כבר רשום כראוי ואין מה לעשות. אם יש לך ספק שהכתיב ברשות האוכלוסין זהה לדרכון — בדוק, ועדכן לפני מילוי הטופס.",
      en: 'For most people the name is already registered correctly and there is nothing to do. If you have any doubt that the spelling at the Population Authority matches your passport, check it, and update it before filling in the form.',
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

  {
    /**
     * ⭐⭐ ADDED 23.9. ס' 3 לנוהל was not modelled anywhere — `origin_country`
     * was collected and nothing read it. A person from a treaty country was
     * shown the standard route with full confidence, when the נוהל says his
     * application is judged under different terms entirely.
     *
     * Chaya's ruling: "most countries are fine but I guess we could say it.
     * Save it as a rule... for now just leave it and mark as it says — only say
     * what it says on the נוהל."
     *
     * So this says exactly what ס' 3 says and stops. We do not hold the treaty
     * list (open question 15), so it never tells him a treaty DOES or does not
     * apply to him — only that the נוהל provides for one, and where to ask.
     */
    id: 'cc.treaty_country',
    name: {
      he: "למדינת המוצא ייתכן הסכם המרה עם ישראל",
      en: 'Your home country may have a conversion treaty with Israel',
    },
    applies_when: CONVERTING,
    check_before: ['cv.online_form', 'cv.attend'],
    consequence_if_invalid: {
      he: "אם בין מדינת המוצא לישראל קיימת אמנה בנושא המרת רישיונות נהיגה, הבקשה שלך תיבחן לפי תנאי אותה אמנה ולא לפי התנאים הרגילים. התנאים עשויים להיות שונים — לטובה או לרעה.",
      en: 'If a conversion treaty exists between your home country and Israel, your application is judged under that treaty rather than the ordinary conditions. Those terms may differ, in either direction.',
    },
    remedy: {
      he: "⚠️ אין בידינו את רשימת המדינות שיש להן אמנה, והנוהל אינו כולל אותה. זו שאלה פתוחה. כדאי לברר מול אגף הרישוי, 02-6663050, אם למדינה שלך יש אמנה עם ישראל.",
      en: '⚠️ We do not hold the list of treaty countries and the procedure does not include it. This is an open question. Worth asking the Licensing Division, 02-6663050, whether your country has a treaty with Israel.',
    },
    evidence: [
      nohal(
        "ס' 3",
        "קיימת אמנה — הבקשה נבחנת לפי תנאי האמנה ולא לפי התנאים הרגילים",
        "ככל ורישיון הנהיגה הלאומי שברשות המבקש ניתן לו ממדינה שבינה לבין ישראל קיימת אמנה בנושא המרת רישיונות נהיגה – תיבחן הבקשה להמרה בהתאם לתנאים שנקבעו באותה אמנה.",
      ),
      notChecked("אילו מדינות חתומות על אמנה עם ישראל, ומה קובעת כל אמנה"),
    ],
  },

  {
    /**
     * ⭐ ADDED 23.9. ס' 1 lists the age condition among the CUMULATIVE
     * conditions of תקנה 216, and the conversion track checked it nowhere —
     * age was used only for the accompaniment clock.
     *
     * ⚠️ And here is the discipline: the נוהל states the requirement and defers
     * the NUMBERS to התקנות, which we have not read. Chaya's own estimate is
     * 16 years and 9 months, and her instruction was "keep it simple" — so this
     * says that a minimum age applies and that we have not verified the figure,
     * rather than printing a number that would look verified. Same rule as the
     * רקורד: never state as fact something the source does not say.
     */
    id: 'cc.age_condition',
    name: {
      he: "תנאי גיל לפי התקנות",
      en: 'The age conditions set out in the regulations',
    },
    applies_when: CONVERTING,
    check_before: ['cv.online_form'],
    consequence_if_invalid: {
      he: "ההמרה מותנית בעמידה בתנאי הגיל הקבועים בתקנות, לצד שאר התנאים. גיל מינימלי חל על כל דרגה.",
      en: 'Conversion is conditional on meeting the age requirements set out in the regulations, alongside the other conditions. A minimum age applies to every grade.',
    },
    remedy: {
      he: "⚠️ הנוהל מפנה לתקנות ואינו נוקב בגילים, ולא בדקנו אותם. אם אתה קרוב לגיל המינימלי לדרגה שביקשת — ברר מול אגף הרישוי, 02-6663050, לפני שתתחיל.",
      en: '⚠️ The procedure points at the regulations without naming the ages, and we have not checked them. If you are near the minimum age for the grade you asked for, check with the Licensing Division, 02-6663050, before you start.',
    },
    evidence: [
      nohal(
        "ס' 1",
        "עמידה בתנאי הגיל הקבועים בתקנות היא אחד התנאים המצטברים להמרה",
        "עמידה בתנאי הגיל הקבועים בתקנות.",
      ),
      notChecked("מהו הגיל המינימלי לכל דרגה לפי התקנות"),
    ],
  },
];
