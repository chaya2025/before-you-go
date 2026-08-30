/**
 * ============================================================================
 * DATES
 * ============================================================================
 *
 * Small, boring, and in its own file on purpose: a wrong deadline is the worst
 * bug this system can produce. Telling someone his five-year window closed when
 * it has not is exactly the failure the product exists to prevent.
 *
 * Deliberately no date library. Everything here is string arithmetic on
 * YYYY-MM and YYYY-MM-DD, which sidesteps the entire category of timezone bugs —
 * there is no "midnight in which country?" question if there is no clock.
 */

/** YYYY-MM, as the intake collects it. */
export type YearMonth = string;
/** YYYY-MM-DD. */
export type IsoDate = string;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const isYearMonth = (v: string): boolean => MONTH.test(v);
export const isIsoDate = (v: string): boolean => DATE.test(v);

/** Months since the start of a year: 2026-08 → 24315. Lets us subtract months by subtracting numbers. */
function toMonthIndex(yearMonth: YearMonth): number | null {
  const m = MONTH.exec(yearMonth);
  if (!m) return null;
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

/**
 * Whole months from `from` to `today`. Negative if `from` is in the future.
 * Returns null if either value is not a real year-month, rather than guessing.
 */
export function monthsSince(from: YearMonth, today: IsoDate): number | null {
  const start = toMonthIndex(from);
  const now = toMonthIndex(today.slice(0, 7));
  if (start === null || now === null) return null;
  return now - start;
}

/**
 * Age in whole years.
 *
 * ⚠️ This is age TODAY. The under-24 ליווי rule actually bites at the moment
 * the licence issues, which can be months away — someone 23 now may be 24 by
 * then. The POC saves nothing between visits, so it cannot track that; what it
 * can do is warn when he is close to the line, which `turns24Within` covers.
 */
export function ageInYears(born: YearMonth, today: IsoDate): number | null {
  const months = monthsSince(born, today);
  if (months === null || months < 0) return null;
  return Math.floor(months / 12);
}

/** Will he cross 24 within this many months? Used to flag a rule that may stop applying mid-process. */
export function turns24Within(born: YearMonth, today: IsoDate, months: number): boolean {
  const monthsOld = monthsSince(born, today);
  if (monthsOld === null || monthsOld < 0) return false;
  const monthsTo24 = 24 * 12 - monthsOld;
  return monthsTo24 > 0 && monthsTo24 <= months;
}

/** Days between two ISO dates. Uses UTC so a timezone can never shift the answer by one. */
export function daysBetween(from: IsoDate, to: IsoDate): number | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return null;
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** `days` after an ISO date, as an ISO date. */
export function addDays(from: IsoDate, days: number): IsoDate | null {
  if (!isIsoDate(from)) return null;
  const t = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10)) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * A YYYY-MM answer as a concrete date.
 *
 * ⚠️ The FIRST of the month, always, and that is a decision rather than a
 * default. A deadline computed from the first is the earliest it could be, so
 * the system warns sooner rather than later. If we are wrong we are wrong in the
 * direction that costs someone an early reminder instead of a missed window.
 */
export function startOfMonth(yearMonth: YearMonth): IsoDate | null {
  return isYearMonth(yearMonth) ? `${yearMonth}-01` : null;
}

/**
 * Whole months from today until a YYYY-MM answer. Negative once it has passed.
 *
 * ⭐ Added 30.8, when the visa, the passport and the foreign licence all needed
 * the same arithmetic. `monthsSince` counts forward from a past event; this
 * counts down to a future one, and having both named makes the direction
 * obvious at the call site instead of hiding it behind a minus sign.
 *
 * ⚠️ 'unknown' in gives 'unknown' out. A date nobody supplied can never make a
 * document expired.
 */
export function monthsUntil(yearMonth: YearMonth | 'unknown', today: IsoDate): number | 'unknown' {
  if (yearMonth === 'unknown') return 'unknown';
  const elapsed = monthsSince(yearMonth, today);
  return elapsed === null ? 'unknown' : -elapsed;
}
