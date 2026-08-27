import type { ClockInput } from '../domain';
import type { Condition } from '../condition';
import { nohal, servicePage, official, fieldReport, LAST_VERIFIED_LATE } from './sources';

/**
 * ============================================================================
 * CLOCKS — four of them, and conflating any two costs someone real time
 * ============================================================================
 *
 * גיליון 13 principle 1 names the worst confusion in the whole domain:
 *
 *   "driving_allowed_until מול conversion_deadline. זו נקודת הבלבול שגורמת
 *    לאנשים לוותר שנים לפני שצריך."
 *
 * ⚠️ Theory validity and the medical declaration used to be clocks here and
 * are not any more. The founder, 27.8: "most people do it and get their licence
 * within 5 years from then." A countdown implies a risk that is not real,
 * and four lines reading "עוד לא התחיל" bury the two clocks that matter.
 * Both are still stated — as plain text on the step they belong to.
 *
 * People hear "one year" and conclude their chance is gone. It is not. They may
 * no longer DRIVE on the foreign licence, but they may still CONVERT it for
 * another four years. Two clocks, two different consequences.
 */

const EVERYONE: Condition = { always: true };
const CONVERTING: Condition = { field: 'track', op: 'eq', value: 'conversion' };

export const CLOCKS: ClockInput[] = [
  {
    id: 'clock.foreign_driving',
    name: {
      he: "עד מתי מותר לנהוג ברישיון הזר",
      en: 'How long you may keep driving on your foreign licence',
    },
    applies_when: CONVERTING,
    // ⚠️ Anchored at ENTRY for everyone, including an עולה whose conversion
    // window counts from עלייה. Same person, two clocks, two starting dates.
    anchor: 'entry_to_israel',
    duration_days: 365,
    on_expiry: {
      he: "מכאן אסור לנהוג ברישיון הזר — אבל עדיין אפשר להמיר אותו. אלה שני דברים נפרדים.",
      en: 'From here you may no longer drive on your foreign licence. You can still convert it. These are two separate things.',
    },
    // The נוהל sets this number itself: start at least 60 days before the year ends.
    warn_before_days: 60,
    evidence: [
      nohal(
        "פרק \"הערות\", תבליט 2",
        "מותר לנהוג ברישיון הזר שנה מיום הכניסה לישראל",
        "ניתן לנהוג באמצעות רישיון נהיגה זר במשך שנה מיום הכניסה לישראל בכפוף לתקנות.",
      ),
      nohal(
        "פרק \"הערות\"",
        "הנוהל עצמו ממליץ להתחיל לפחות 60 יום לפני תום שנת השהייה",
        "מומלץ להגיש את הבקשה ולהתחיל את התהליך לכל הפחות 60 ימים לפני תום שנת שהייה בישראל.",
      ),
    ],
  },

  {
    id: 'clock.conversion_window',
    name: { he: "עד מתי אפשר להגיש בקשת המרה", en: 'How long you have to apply for conversion' },
    applies_when: CONVERTING,
    // ⚠️ Resolves per category: עלייה / שיבה / כניסה. Not one shared date.
    anchor: 'category_anchor',
    duration_days: 1826, // five years
    on_expiry: {
      he: "חלון ההמרה נסגר. עדיין אפשר להוציא רישיון ישראלי — במסלול מאפס.",
      en: 'The conversion window has closed. You can still get an Israeli licence, through the from-scratch route.',
    },
    warn_before_days: 90,
    evidence: [
      nohal(
        "ס' 1(א), 1(ב), 1(ג)",
        "חמש שנים לכל אחת משלוש הקטגוריות — מיום העלייה, מיום השיבה, או מיום הכניסה",
        "והגיש את בקשתו בתוך חמש שנים מיום עלייתו... בתוך חמש שנים מיום שובו לישראל... בתוך חמש שנים מיום כניסתו לישראל.",
      ),
    ],
  },

  {
    id: 'clock.accompaniment',
    name: { he: "תקופת הליווי", en: 'The accompanied-driving period' },
    applies_when: { field: 'age_years', op: 'lt', value: 24 },
    /**
     * ⭐⭐ THE STRONGEST FINDING IN THE RESEARCH, and the reason the whole
     * product has a thesis.
     *
     * The clock starts at LICENCE ISSUANCE, not at passing the test. For a
     * citizen the permit arrives online within 72 hours, so the two dates are
     * effectively the same. For someone without a teudat zehut the permit needs
     * an appointment and a physical visit, and the gap can run to months — every
     * day of which is pushed onto the END of the accompaniment period.
     *
     * Identical rule. Wildly different outcome. And it is evidenced by the
     * state's own wording, not only by one person's experience: The founder saw the
     * date printed on the document itself.
     */
    anchor: 'license_issued',
    duration_days: 182,
    on_expiry: {
      he: "אפשר להגיש הצהרת סיום ליווי.",
      en: 'You can submit the declaration that the accompaniment period is complete.',
    },
    warn_before_days: 14,
    evidence: [
      servicePage(
        "הגשת בקשה להוצאת רישיון נהיגה",
        "התקופה נספרת מיום הוצאת רישיון הנהיגה, ולא מיום הטסט",
        "מתחת לגיל 24 - הרישיון יישלח רק לאחר הצהרת נהג חדש על סיום תכנית הליווי, בתנאי שעברה חצי שנה מיום הוצאת רישיון הנהיגה ובתנאי שלא נעברה עבירה.",
      ),
      fieldReport(
        "תאריך תחילת התקופה מודפס על המסמך עצמו — כל עיכוב בהוצאת ההיתר נדחף לסוף התקופה. בדיווח: חודשיים עיכוב עלו בחודשיים ליווי נוספים",
      ),
    ],
  },

  {
    id: 'clock.duplicate_delivery_choice',
    name: {
      he: "⏱️ החלון שבו אתה בוחר איך לקבל את הרישיון",
      en: '⏱️ Your window to choose how the licence reaches you',
    },
    applies_when: EVERYONE,
    anchor: 'duplicate_fee_paid',
    /**
     * ⚠️ The shortest window in the entire research. Nothing else is close.
     * It is a choice of delivery method, made at fastdl.co.il.
     */
    duration_days: 2,
    on_expiry: {
      he: "לא ניתן לבחור יותר את אופן המסירה. ככל הנראה הרישיון יישלח בדואר.",
      en: 'You can no longer choose a delivery method. It will most likely be sent by post.',
    },
    warn_before_days: 1,
    evidence: [
      official(
        'דף "הוצאת העתק רישיון נהיגה", משרד התחבורה',
        "החלון לשינוי אופן המסירה מתועד רשמית",
        "ביום שאחרי ביצוע התשלום ועד 2 ימי עסקים, ניתן לשנות את אופן קבלת הרישיון ואת יעד המסירה.",
        'https://www.gov.il/he/service/duplicate_drivers_license_in_case_of_loss',
        LAST_VERIFIED_LATE,
      ),
      fieldReport("החלון נפתח מיד עם התשלום בדואר, והבחירה נעשית באתר fastdl.co.il", {
        last_verified_at: LAST_VERIFIED_LATE,
      }),
    ],
  },


];
