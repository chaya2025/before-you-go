import type { Result, Text, NohalCategory, Process } from '@byg/engine';

/**
 * ============================================================================
 * Talking to the API
 * ============================================================================
 *
 * ⭐ The only file in the website that knows the API exists. Everything else
 * receives finished data and renders it.
 *
 * ⚠️ Note what is imported: `Result` and `Text`, from the engine. TYPES ONLY.
 * The website never runs a rule — but it does borrow the SHAPE of the answer,
 * so if that shape ever changes, this app stops compiling instead of quietly
 * rendering nothing. That is the API contract, enforced by the compiler.
 */

/**
 * Where the API lives.
 *
 * In development the website (5173) and the API (3001) are two different
 * servers, so the address has to be spelled out in full.
 *
 * In a production build they are served by the SAME server, so the address is
 * the empty string: every request becomes a RELATIVE url (`/api/v1/...`) and
 * the browser sends it back to whatever host served the page. That means the
 * deployed URL is never written down anywhere and can never go stale.
 *
 * `VITE_API_BASE` is an escape hatch: set it at build time and it wins. That is
 * what we would use if the API ever moved to its own domain.
 */
const BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:3001');

export type StatusOption = {
  value: string;
  label: Text;
  /** From the engine's data, so the website never decides this itself. */
  nohal_category: NohalCategory;
  usually_has_teudat_zehut: boolean | 'unknown';
  identity_document: Text;
  caveat: Text | null;
};

export type StatusesResponse = {
  statuses: StatusOption[];
  license_classes: string[];
};

/** A validation failure, per field, so the form can point at the question. */
export type FieldIssue = { field: string; message: string };

export class ValidationError extends Error {
  constructor(public issues: FieldIssue[]) {
    super('invalid profile');
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * The visa list, so the form holds no domain knowledge of its own.
 * A change to the data file reaches the screen without this app being touched.
 */
export const fetchStatuses = () => get<StatusesResponse>('/api/v1/statuses');

/**
 * The real call. Answers in, readiness out.
 *
 * `today` is passed explicitly rather than read from the browser clock, so the
 * screen and the tests can be made to agree exactly.
 */
export async function fetchReadiness(
  profile: Record<string, unknown>,
  today?: string,
): Promise<Result> {
  const res = await fetch(`${BASE}/api/v1/readiness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(today ? { ...profile, today } : profile),
  });

  if (res.status === 422) {
    const body = (await res.json()) as { issues: FieldIssue[] };
    throw new ValidationError(body.issues);
  }
  if (!res.ok) throw new Error(`the server returned ${res.status}`);

  return res.json() as Promise<Result>;
}

/**
 * ⭐ The plain-language layer. Asked for ON DEMAND, never automatically.
 *
 * ⚠️ This is the only paid call in the product, and every other screen must
 * stay free. Ticking a step re-runs the engine; if this were folded into
 * fetchReadiness it would spend money on every checkbox click.
 *
 * ⚠️ It sends the PROFILE, not the Result. A Result posted from a browser is a
 * Result a browser could have edited, and the server would then be wrapping
 * friendly words around a decision the engine never made.
 *
 * ⚠️ It never throws for a model failure. No key, no credit, no network — all
 * come back 200 with the deterministic text and `source: "deterministic"`.
 */
export type Explanation = {
  text: string;
  source: 'model' | 'deterministic';
  reason?: 'no_key' | 'call_failed' | 'empty_response';
};

export async function fetchExplanation(
  profile: Record<string, unknown>,
  lang: 'he' | 'en',
  today?: string,
): Promise<Explanation> {
  const res = await fetch(`${BASE}/api/v1/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...profile, lang, ...(today ? { today } : {}) }),
  });
  if (!res.ok) throw new Error(`the server returned ${res.status}`);
  return res.json() as Promise<Explanation>;
}

/** Is the plain-language layer switched on where this is deployed? */
export const fetchCapabilities = () => get<{ plain_language: boolean }>('/api/v1/capabilities');

/**
 * What this system can check you are ready for.
 *
 * ⚠️ Asked, not hardcoded — the same rule as the visa list. When a second
 * process becomes real, the landing page changes without this app being edited.
 */
export const fetchProcesses = () => get<{ processes: Process[] }>('/api/v1/processes');
