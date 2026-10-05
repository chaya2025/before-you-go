/**
 * ⭐ Stale answers (M1 milestone 3, D-127, the founder caught it).
 *
 * Saving the INPUTS keeps every date current: the engine re-runs with today's
 * date on each visit. What it cannot see is the world changing under an
 * answer. He renewed his visa; he got a new passport; his visa type changed.
 * The saved answer still says the old thing, and the road is built on it.
 *
 * So, on a return visit:
 *   1. a document that expired since he last confirmed his details, or is
 *      about to, is asked about BEFORE the road (`staleDocs`);
 *   2. the key facts sit on one card with a "nothing changed" button;
 *   3. when an update moves the road, the screen says what moved and why
 *      (`whatChanged`).
 *
 * Everything here is pure (no network, no screen), so it is tested directly.
 */
import type { Result } from '@byg/engine';

/** The three expiry answers a return visit checks. All are 'YYYY-MM'. */
export type DocField = 'visa_expires' | 'passport_expires' | 'license_expires';

export type StaleDoc = {
  field: DocField;
  /** 'YYYY-MM' as he gave it. */
  expires: string;
  /** Lapsed since he last confirmed, or lapses within SOON_MONTHS. */
  kind: 'expired' | 'soon';
};

/** "Expiring soon" means this month or the next two. */
export const SOON_MONTHS = 2;

const month = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** 'YYYY-MM' plus n months. */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

/** Where each expiry lives in the answers. The licence one is nested. */
export function readExpiry(answers: Record<string, unknown>, field: DocField): string | null {
  const v =
    field === 'license_expires'
      ? (answers.foreign_license as Record<string, unknown> | undefined)?.expires
      : answers[field];
  return isMonth(v) ? v : null;
}

/**
 * Which documents to ask about first.
 *
 * ⚠️ "Expired" means expired SINCE he last confirmed: still valid on the day
 * he said "these are right", lapsed by today. A document that was already
 * expired when he confirmed is something he told us, not news; the engine
 * already deals with it, and asking again would be nagging him about a fact
 * he gave us himself.
 *
 * ⚠️ Months are compared as text ('2026-03' < '2026-10'), which is correct
 * only because they are zero-padded 'YYYY-MM'. `isMonth` guarantees that.
 */
export function staleDocs(answers: Record<string, unknown>, confirmedAt: Date, today: Date): StaleDoc[] {
  const now = month(today);
  const confirmed = month(confirmedAt);
  const soonUntil = addMonths(now, SOON_MONTHS);
  const out: StaleDoc[] = [];
  for (const field of ['visa_expires', 'passport_expires', 'license_expires'] as const) {
    const e = readExpiry(answers, field);
    if (!e) continue;
    // A licence he does not hold has no expiry worth asking about.
    if (field === 'license_expires' && (answers.foreign_license as { kind?: string } | undefined)?.kind === 'none') continue;
    if (e < now && e >= confirmed) out.push({ field, expires: e, kind: 'expired' });
    else if (e >= now && e <= soonUntil) out.push({ field, expires: e, kind: 'soon' });
  }
  return out;
}

/**
 * His answer to "did you renew it?", applied to the answers.
 *   renewed with a new expiry → the new month, and a visa is valid again;
 *   not renewed               → a visa is marked not valid, so the engine puts
 *                               the lapsed visa first, where it belongs.
 * A passport or licence that was not renewed keeps its date: the engine
 * already reads an expired date as expired.
 */
export function applyRenewal(
  answers: Record<string, unknown>,
  field: DocField,
  renewedUntil: string | null,
): Record<string, unknown> {
  const next = { ...answers };
  if (field === 'license_expires') {
    if (renewedUntil) next.foreign_license = { ...(answers.foreign_license as object), expires: renewedUntil };
    return next;
  }
  if (renewedUntil) next[field] = renewedUntil;
  if (field === 'visa_expires') next.visa_valid_now = renewedUntil ? true : false;
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// What changed, and why
// ─────────────────────────────────────────────────────────────────────────────

/** The answers a person can change from the quick-check card or the ask. */
export const WATCHED = ['visa_type', 'visa_valid_now', 'visa_expires', 'passport_expires', 'license_expires'] as const;
export type Watched = (typeof WATCHED)[number];

export type Change = {
  /** Why: the answers that are different now. */
  causes: { field: Watched; from: unknown; to: unknown }[];
  trackFrom: string | null;
  trackTo: string | null;
  stepsAdded: string[];
  stepsRemoved: string[];
  urgentAdded: string[];
  urgentCleared: string[];
  blockedNow: boolean;
  unblocked: boolean;
};

const answerOf = (a: Record<string, unknown>, f: Watched) =>
  f === 'license_expires' ? readExpiry(a, 'license_expires') : (a[f] ?? null);

/**
 * Compare the road before and after an update. Read off the two results,
 * never recomputed: the engine decided, this only reports the difference.
 * Returns null when nothing he would see has moved.
 */
export function whatChanged(
  before: Result,
  after: Result,
  beforeAnswers: Record<string, unknown>,
  afterAnswers: Record<string, unknown>,
): Change | null {
  const causes = WATCHED.filter((f) => answerOf(beforeAnswers, f) !== answerOf(afterAnswers, f)).map((f) => ({
    field: f,
    from: answerOf(beforeAnswers, f),
    to: answerOf(afterAnswers, f),
  }));
  const ids = (r: Result) => new Set(r.roadmap.map((s) => s.step.id));
  const urgent = (r: Result) => new Set(r.urgent.map((u) => u.id));
  const [b, a, ub, ua] = [ids(before), ids(after), urgent(before), urgent(after)];
  const trackFrom = before.diagnosis.track;
  const trackTo = after.diagnosis.track;
  const change: Change = {
    causes,
    trackFrom: trackFrom !== trackTo ? trackFrom : null,
    trackTo: trackFrom !== trackTo ? trackTo : null,
    stepsAdded: [...a].filter((id) => !b.has(id)),
    stepsRemoved: [...b].filter((id) => !a.has(id)),
    urgentAdded: [...ua].filter((id) => !ub.has(id)),
    urgentCleared: [...ub].filter((id) => !ua.has(id)),
    blockedNow: !before.blocked && !!after.blocked,
    unblocked: !!before.blocked && !after.blocked,
  };
  const moved =
    change.trackFrom !== null ||
    change.stepsAdded.length ||
    change.stepsRemoved.length ||
    change.urgentAdded.length ||
    change.urgentCleared.length ||
    change.blockedNow ||
    change.unblocked;
  return moved ? change : null;
}
