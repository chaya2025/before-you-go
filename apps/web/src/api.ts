import type { Result, Text, NohalCategory, Process } from '@byg/engine';
import { askProfile } from './askProfile';

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

/**
 * ⭐ M3: send a photo or PDF to be read. The answer is a SUGGESTION for one
 * field on the documents screen; he confirms it there. Never throws for a
 * reading failure: `ok: false` means "try again or type it".
 */
export type DocKind = 'form_89' | 'passport' | 'visa' | 'licence';
type ReadFields = { expires?: string; number?: string; passport_number?: string; name_latin?: string; language?: 'he' | 'en' | 'other' };
/** D-25: why a box the read could not fill is empty. */
export type ReadFlags = Partial<Record<keyof ReadFields, 'invalid' | 'missing'>>;
export type Reading =
  | { ok: true; kind: DocKind; fields: ReadFields; flags: ReadFlags }
  | { ok: false; reason: string; seen?: string };

export async function readDocument(kind: DocKind, file: File, token: string | undefined): Promise<Reading> {
  if (!token) return { ok: false, reason: 'no_login' };
  const post = (path: string, body: object) =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  try {
    // 1. A one-time ticket for this one file (needs his login, and reads left).
    const linkRes = await post('/api/v1/upload-link', { kind, media_type: file.type });
    if (linkRes.status === 401) return { ok: false, reason: 'no_login' };
    if (!linkRes.ok) return { ok: false, reason: linkRes.status === 400 ? 'bad_file' : 'call_failed' };
    const link = (await linkRes.json()) as
      | { ok: true; url: string; fields: Record<string, string>; key: string; max_bytes: number }
      | { ok: false; reason: string };
    if (!link.ok) return link;
    if (file.size > link.max_bytes) return { ok: false, reason: 'too_big' };

    // 2. Straight into the private bucket. The file never passes through our server.
    const form = new FormData();
    for (const [k, v] of Object.entries(link.fields)) form.append(k, v);
    form.append('file', file); // S3 requires the file last.
    const up = await fetch(link.url, { method: 'POST', body: form });
    if (!up.ok) return { ok: false, reason: up.status === 400 ? 'too_big' : 'call_failed' };

    // 3. We read it from the bucket (this is what uses up one of his reads).
    const res = await post('/api/v1/read-document', { kind, key: link.key });
    if (res.status === 401) return { ok: false, reason: 'no_login' };
    if (!res.ok) return { ok: false, reason: 'call_failed' };
    return (await res.json()) as Reading;
  } catch {
    return { ok: false, reason: 'call_failed' };
  }
}

/**
 * ============================================================================
 * ⭐ M6: ask about your case (CONTRACT.md section 3)
 * ============================================================================
 *
 * The chat lives in its OWN small service (Python, apps/assistant), not in the
 * TS API above, so it has its own address. Same rule as BASE: spelled out in
 * development (the service runs on 8001), relative in production, and
 * VITE_ASK_BASE wins when set at build time.
 */
const ASK_BASE = import.meta.env.VITE_ASK_BASE ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8001');

/** Every answer the service can give. The panel has a calm line for each. */
export const ASK_STATUSES = ['answered', 'not_sure', 'other_person', 'limit', 'unavailable', 'no_login'] as const;
export type AskStatus = (typeof ASK_STATUSES)[number];
/**
 * ⚠️ Contract amendment 1: a source may carry a `claim` and no `citation`, so
 * both are optional and the screen shows `citation ?? claim`.
 */
export type AskSource = { citation?: string | null; claim?: string | null; url?: string | null; last_verified_at?: string | null };
export type AskReply = { status: AskStatus; answer: string; sources: AskSource[] };
export type AskTurn = { role: 'user' | 'assistant'; text: string };
export type AskRequest = {
  question: string;
  lang: 'he' | 'en';
  mode: 'case' | 'general';
  /** Case mode only: the same body the readiness call takes, so the service rebuilds HIS road. */
  profile?: Record<string, unknown>;
  today?: string;
  /** "Ask about this step" (D-227). */
  step_id?: string;
  history?: AskTurn[];
};

/**
 * ⚠️ The service remembers nothing between questions (D-218), so the last few
 * turns ride along with each one. Six, and only six: older turns cost money to
 * re-read and rarely matter to the next question.
 */
export const ASK_HISTORY_MAX = 6;

const quiet = (status: AskStatus): AskReply => ({ status, answer: '', sources: [] });

/**
 * ⚠️ NEVER THROWS. Same rule as fetchExplanation: the chat is extra, the road
 * is the product. Down, slow, broken or changed, it all comes back as a status
 * the panel can say calmly, and nothing else on the page notices.
 *
 * The token is the user's Supabase login (D-222): the service needs it to count
 * his 20 questions a day. No token means no call at all.
 */
export async function askQuestion(req: AskRequest, token: string | undefined): Promise<AskReply> {
  if (!token) return quiet('no_login');
  const body: AskRequest = {
    ...req,
    // ⚠️ Cleaned HERE, in the one function that talks to the service, so no
    // caller can send passport numbers or names by forgetting to (askProfile.ts).
    ...(req.profile ? { profile: askProfile(req.profile) } : {}),
    ...(req.history ? { history: req.history.slice(-ASK_HISTORY_MAX) } : {}),
  };
  try {
    const res = await fetch(`${ASK_BASE}/api/v1/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    // An expired or refused login: the way back in is to log in again.
    if (res.status === 401) return quiet('no_login');
    if (!res.ok) return quiet('unavailable');
    const data = (await res.json()) as Partial<AskReply>;
    // ⚠️ Trust only the shape the contract promises. A status this screen does
    // not know would otherwise render as a blank bubble.
    if (!data || !ASK_STATUSES.includes(data.status as AskStatus)) return quiet('unavailable');
    return {
      status: data.status as AskStatus,
      answer: typeof data.answer === 'string' ? data.answer : '',
      sources: Array.isArray(data.sources) ? data.sources : [],
    };
  } catch {
    return quiet('unavailable');
  }
}
