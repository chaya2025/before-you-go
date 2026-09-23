import type { Condition } from '../condition';

/**
 * ============================================================================
 * SHARED RULES — conditions the נוהל states once and the engine must apply
 * in every place they show
 * ============================================================================
 *
 * ⭐ Created 23.9, Chaya: "we have to first apply it in the engine as a set
 * rule and then fix all wherever it shows now."
 *
 * The רקורד is why this file exists. It was scoped on the STEP and left
 * unscoped on the DOCUMENT, so the same clause meant two different things in
 * two files and a two-year holder stopped seeing the step while still being
 * told to bring the document. A rule written twice is a rule that drifts.
 *
 * Anything here is quoted from the נוהל, never inferred. Each export names the
 * clause it comes from.
 */

/**
 * נוהל ס' 1: "לעניין דרגות נהיגה הקבועות בתקנות 176 עד 181 (דרגות C1, B, A,
 * A1, A2, 1) נדרשת עמידה גם במבחן שליטה".
 *
 * The light grades. These are the ones a מבחן שליטה belongs to, and the only
 * ones open to a תושב מדינת חוץ.
 */
export const GRADES_176_181: Condition = {
  field: 'requested_class',
  op: 'in',
  value: ['A2', 'A1', 'A', '1', 'B', 'C1'],
};

/**
 * נוהל ס' 1: "לעניין דרגות נהיגה הקבועות בתקנות 182 עד 185 (E, C, D, D1, D2,
 * D3) נדרש סיום קורס לנהגי רכב ציבורי/כבד, נדרשת עמידה בבדיקות רפואיות
 * ובבחינות, מילוי אחר תקנה 189(ד)(3) וכן שלא התקיים במבקש האמור בתקנה 15ב".
 *
 * ⚠️ A מבחן שליטה is NOT among them. The control test is scoped to 176-181 and
 * these grades carry בחינות instead — a different thing under a different name.
 */
export const GRADES_182_185: Condition = {
  field: 'requested_class',
  op: 'in',
  value: ['C', 'D', 'D1', 'D2', 'D3', 'E'],
};

/**
 * ⭐⭐ THE RECORD RULE, and the reason this file exists.
 *
 * נוהל, פרק "מסמכים נדרשים", identically in all three category lists:
 *
 *   "רקורד - למעוניינים בקבלת פטור ממבחן שליטה ובדיקת ראיה (בעלי רישיון נהיגה
 *    לאומי קבוע במשך חמש שנים לפחות, כאמור) נדרש להציג אסמכתה מגורם מוסמך
 *    ממדינת המוצא המציינת את מועד הוצאת רישיון הנהיגה הקבוע."
 *
 * Read it twice, because it is conditional twice:
 *   1. "למעוניינים בקבלת פטור" — for those who WANT the exemption. An offer.
 *   2. "בעלי רישיון נהיגה לאומי קבוע במשך חמש שנים לפחות" — and only a
 *      five-year holder can want it, because ס' 2 gives the exemption to nobody
 *      else.
 *
 * So under five years the רקורד buys nothing at all, and asking a man to chase
 * a document from a foreign authority for nothing is a real cost with no
 * benefit. Chaya, 23.9: "the רקורד only applies to someone who has more than 5
 * years of driving, and again it's only a recommendation for the פטור and not
 * a must."
 *
 * ⚠️ `gte 5` against an unanswered seniority is UNKNOWN, not false, so both the
 * step and the document render as uncertain rather than vanishing. A long-lead
 * item must never be hidden by a question nobody asked.
 */
export const RECORD_RELEVANT: Condition = {
  field: 'foreign_license_years',
  op: 'gte',
  value: 5,
};
