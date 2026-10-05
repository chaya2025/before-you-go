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

export type Account = { email: string } | null;

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
  return data.session?.user.email ? { email: data.session.user.email } : null;
}

/**
 * Fires on log in, log out, and when someone arrives from a reset-password
 * email (`recovering` true: show "choose a new password", not the road).
 */
export function onAccountChange(cb: (a: Account, recovering: boolean) => void): () => void {
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((event, session) => {
    const email = session?.user.email;
    cb(email ? { email } : null, event === 'PASSWORD_RECOVERY');
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
