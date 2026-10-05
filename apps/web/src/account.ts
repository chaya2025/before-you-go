/**
 * ⭐ The ONE file that talks to Supabase (M1, D-144, D-145).
 *
 * Everything about accounts goes through here: sign up, log in, Google, log
 * out, forgot password. No other file imports supabase-js. Why: if Matan ever
 * says "move it all to AWS", this file is what changes, not every screen.
 *
 * Supabase is the login service + database. The key below is the PUBLISHABLE
 * one: it is public by design and safe in the browser. What actually protects
 * a user's data is RLS (Row Level Security), a rule inside the database that
 * only lets a logged-in user touch their own rows. The secret service_role key
 * never comes anywhere near this app.
 *
 * ⚠️ Accounts are optional (D-146). If the two settings are missing, or
 * Supabase is down, `accountsEnabled` is false, the account button simply does
 * not appear, and the site works exactly as it did before M1.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const accountsEnabled = Boolean(url && key);
const client: SupabaseClient | null = accountsEnabled ? createClient(url!, key!) : null;

/**
 * ⚠️ Email + password is switched OFF unless this says "on" (D-154). Supabase's
 * free email sender only reaches the project team, so a real user would never
 * get the confirm or reset email. Google only, until there is a domain and a
 * real sender; then this goes on in Render's settings, no code change.
 */
export const emailLogin = import.meta.env.VITE_EMAIL_LOGIN === 'on';

/**
 * What the header shows. `name` and `photo` come from Google when the user
 * logs in with it; an email sign-up has neither, so the header falls back to
 * the first letter of the address.
 */
export type Account = { email: string; name: string | null; photo: string | null } | null;

type SessionUser = { email?: string; user_metadata?: Record<string, unknown> };

/** Pure, so it is tested without a network. */
export function accountFrom(user: SessionUser | null | undefined): Account {
  if (!user?.email) return null;
  const m = user.user_metadata ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return { email: user.email, name: str(m.full_name) ?? str(m.name), photo: str(m.avatar_url) ?? str(m.picture) };
}

/** First name for the button; the address's first letter when there's no name. */
export const firstName = (a: NonNullable<Account>) => a.name?.split(/\s+/)[0] ?? null;
export const initial = (a: NonNullable<Account>) => (a.name ?? a.email).trim().charAt(0).toUpperCase();

/** Every failure the panel knows how to explain, in the user's language. */
export type AuthProblem =
  | 'bad_login'
  | 'not_confirmed'
  | 'weak_password'
  | 'bad_email'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export type AuthResult = { ok: true; checkEmail?: boolean } | { ok: false; problem: AuthProblem };

/** Supabase's own minimum is 6. Ours is 8: this guards immigration paperwork. */
export const MIN_PASSWORD = 8;

/**
 * Turn a Supabase error into one of ours. Pure, so it is tested without a
 * network. Supabase gives a `code` on modern errors; `status` 0 or a thrown
 * fetch means the request never reached it.
 */
export function problemFrom(e: { code?: string; status?: number; message?: string } | null | undefined): AuthProblem {
  if (!e) return 'unknown';
  switch (e.code) {
    case 'invalid_credentials':
      return 'bad_login';
    case 'email_not_confirmed':
      return 'not_confirmed';
    case 'weak_password':
      return 'weak_password';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'bad_email';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'rate_limited';
  }
  if (e.status === 0 || /fetch|network/i.test(e.message ?? '')) return 'network';
  if (e.status === 429) return 'rate_limited';
  return 'unknown';
}

/** Checked in the browser before anything is sent. */
export function checkCredentials(email: string, password: string | null): AuthProblem | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'bad_email';
  if (password !== null && password.length < MIN_PASSWORD) return 'weak_password';
  return null;
}

/**
 * ⚠️ An email link works ONCE. Clicking a used or expired one sends the person
 * back here with the reason in the address, e.g.
 * `#error=access_denied&error_code=otp_expired&error_description=...`.
 * Ignoring it lands them on the home page, logged out, with no word why: the
 * bug the founder hit on 2026-10-05. Pure, so it is tested; checks the part after #
 * and after ?, since Supabase has used both.
 */
export function linkProblem(href: string): 'expired' | 'other' | null {
  const u = new URL(href);
  const params = new URLSearchParams(u.hash.replace(/^#/, ''));
  const q = u.searchParams;
  const code = params.get('error_code') ?? q.get('error_code');
  const error = params.get('error') ?? q.get('error');
  if (!code && !error) return null;
  return code === 'otp_expired' || error === 'access_denied' ? 'expired' : 'other';
}

/** Remove the error from the address bar, so a refresh doesn't show it again. */
export function clearLinkProblem() {
  history.replaceState(null, '', window.location.pathname);
}

/** Where Supabase sends people back to after an email link or Google. */
const home = () => window.location.origin + window.location.pathname;

async function run(call: () => Promise<{ error: unknown }>): Promise<AuthResult> {
  if (!client) return { ok: false, problem: 'unknown' };
  try {
    const { error } = await call();
    return error ? { ok: false, problem: problemFrom(error as never) } : { ok: true };
  } catch {
    return { ok: false, problem: 'network' };
  }
}

export async function getAccount(): Promise<Account> {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return accountFrom(data.session?.user);
}

/**
 * Fires on log in, log out, and when someone arrives from a reset-password
 * email (`recovering` true: show "choose a new password", not the road).
 */
export function onAccountChange(cb: (a: Account, recovering: boolean) => void): () => void {
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((event, session) => {
    cb(accountFrom(session?.user), event === 'PASSWORD_RECOVERY');
  });
  return () => data.subscription.unsubscribe();
}

/**
 * ⚠️ With email confirmation on, Supabase answers a sign-up for an address
 * that ALREADY has an account with no error, and sends nothing. That is on
 * purpose: otherwise anyone could type an address and learn whether that
 * person uses the site. So both cases get the same "check your email".
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const r = await run(() =>
    client!.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: home() } }),
  );
  return r.ok ? { ok: true, checkEmail: true } : r;
}

export const logIn = (email: string, password: string) =>
  run(() => client!.auth.signInWithPassword({ email: email.trim(), password }));

/** Leaves the page for Google, and comes back logged in. */
export const logInWithGoogle = () =>
  run(() => client!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: home() } }));

export const logOut = () => run(() => client!.auth.signOut());

/** Same answer whether or not the address has an account, for the same reason as signUp. */
export async function sendReset(email: string): Promise<AuthResult> {
  const r = await run(() => client!.auth.resetPasswordForEmail(email.trim(), { redirectTo: home() }));
  return r.ok ? { ok: true, checkEmail: true } : r;
}

export const setNewPassword = (password: string) => run(() => client!.auth.updateUser({ password }));

// ═══════════════════════════════════════════════════════════════════════════
// Saved cases (M1 milestone 2). Still the only file that talks to Supabase.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ Never stored (plan, "Never stored"): document numbers and names. The
 * engine only COMPARES these (does the 89 carry the passport he holds today?)
 * and never shows them, so on a return visit those checks honestly read "not
 * checked yet" until he types them again. The database refuses them as well
 * (constraint cases_no_document_numbers), so this is the first of two locks.
 */
export const NEVER_STORED = [
  'passport_number',
  'form_89_number',
  'form_89_passport_number',
  'passport_name_latin',
  'form_89_name_latin',
] as const;
export const NEVER_STORED_IN_LICENSE = ['name_latin'] as const;

/** A copy of the answers that is safe to save. Pure, so it is tested. */
export function storable(answers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...answers };
  for (const k of NEVER_STORED) delete out[k];
  delete out.completed_steps; // saved on its own, as `done`
  const fl = out.foreign_license;
  if (fl && typeof fl === 'object') {
    const copy = { ...(fl as Record<string, unknown>) };
    for (const k of NEVER_STORED_IN_LICENSE) delete copy[k];
    out.foreign_license = copy;
  }
  return out;
}

export type SavedCase = {
  id: string;
  answers: Record<string, unknown>;
  done: string[];
  confirmedAt: string;
  updatedAt: string;
};

type CaseRow = { id: string; answers: Record<string, unknown>; done: string[]; confirmed_at: string; updated_at: string };
const toCase = (r: CaseRow): SavedCase => ({
  id: r.id,
  answers: r.answers,
  done: r.done,
  confirmedAt: r.confirmed_at,
  updatedAt: r.updated_at,
});

/**
 * The newest case. An account can hold several (family, D-152); until the
 * screens to switch between them exist, the newest is the one shown.
 * RLS means this only ever sees the logged-in person's own rows.
 */
export async function loadNewestCase(): Promise<SavedCase | null> {
  if (!client) return null;
  const { data, error } = await client
    .from('cases')
    .select('id, answers, done, confirmed_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toCase(data as CaseRow) : null;
}

/**
 * Create (no id) or update (id) a case. `confirmed` true means he just
 * answered or edited the questions, so his "these are right" date moves;
 * ticking a step leaves it alone.
 */
export async function saveCase(
  id: string | null,
  answers: Record<string, unknown>,
  done: string[],
  confirmed: boolean,
): Promise<SavedCase> {
  if (!client) throw new Error('accounts off');
  const row = {
    answers: storable(answers),
    done,
    ...(confirmed ? { confirmed_at: new Date().toISOString() } : {}),
  };
  const q = id
    ? client.from('cases').update(row).eq('id', id)
    : client.from('cases').insert(row);
  const { data, error } = await q.select('id, answers, done, confirmed_at, updated_at').single();
  if (error) throw error;
  return toCase(data as CaseRow);
}

/** The language he last chose, or null if he never chose one. */
export async function loadLang(): Promise<'he' | 'en' | null> {
  if (!client) return null;
  const { data } = await client.from('profiles').select('lang').maybeSingle();
  return (data?.lang as 'he' | 'en' | undefined) ?? null;
}

export async function saveLang(lang: 'he' | 'en'): Promise<void> {
  if (!client) return;
  const { data: u } = await client.auth.getUser();
  if (!u.user) return;
  await client.from('profiles').upsert({ user_id: u.user.id, lang });
}

/**
 * ⚠️ A guest's answers survive the trip to Google and back (D-146: "save"
 * asks him to sign up and carries his answers over). The page is left
 * entirely for Google, so they wait in sessionStorage: this tab only, gone
 * when the tab closes, and taken out the moment they are saved to his account.
 * Already stripped of document numbers before they are put there.
 */
const PENDING = 'byg.pending-case';

export function stashPending(answers: Record<string, unknown>, done: string[]) {
  try {
    sessionStorage.setItem(PENDING, JSON.stringify({ answers: storable(answers), done }));
  } catch {
    /* private mode: the carry-over is lost, nothing else breaks */
  }
}

export function takePending(): { answers: Record<string, unknown>; done: string[] } | null {
  try {
    const raw = sessionStorage.getItem(PENDING);
    sessionStorage.removeItem(PENDING);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
