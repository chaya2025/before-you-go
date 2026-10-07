import { describe, expect, it } from 'vitest';
import { linkProblem, accountFrom, hasPassword, checkCredentials, firstName, initial, problemFrom, MIN_PASSWORD } from './account';
import { UI } from './i18n';

/**
 * The account panel shows one message per problem. These pin the mapping from
 * Supabase's error codes to our problems, and that every problem has words in
 * both languages, so a new code can never surface as a blank line.
 */
describe('problemFrom', () => {
  it.each([
    [{ code: 'invalid_credentials', status: 400 }, 'bad_login'],
    [{ code: 'email_not_confirmed', status: 400 }, 'not_confirmed'],
    [{ code: 'weak_password', status: 422 }, 'weak_password'],
    [{ code: 'email_address_invalid', status: 400 }, 'bad_email'],
    [{ code: 'validation_failed', status: 400 }, 'bad_email'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'rate_limited'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'rate_limited'],
    [{ status: 429 }, 'rate_limited'],
    [{ status: 0, message: 'Failed to fetch' }, 'network'],
    [{ message: 'TypeError: NetworkError when attempting to fetch resource.' }, 'network'],
    [{ code: 'something_new', status: 500 }, 'unknown'],
    [null, 'unknown'],
  ] as const)('%j → %s', (e, want) => {
    expect(problemFrom(e as never)).toBe(want);
  });
});

describe('checkCredentials', () => {
  it('accepts a normal address and a long enough password', () => {
    expect(checkCredentials('dana@example.com', 'a'.repeat(MIN_PASSWORD))).toBeNull();
  });
  it('trims spaces around the address', () => {
    expect(checkCredentials('  dana@example.com ', null)).toBeNull();
  });
  it.each(['', 'dana', 'dana@', '@example.com', 'dana@example', 'da na@example.com'])('rejects %j', (email) => {
    expect(checkCredentials(email, null)).toBe('bad_email');
  });
  it('rejects a password one short of the minimum, accepts the minimum', () => {
    expect(checkCredentials('dana@example.com', 'a'.repeat(MIN_PASSWORD - 1))).toBe('weak_password');
    expect(checkCredentials('dana@example.com', 'a'.repeat(MIN_PASSWORD))).toBeNull();
  });
  it('the minimum is 8, pinned as a number (not read back from the code)', () => {
    expect(checkCredentials('dana@example.com', '1234567')).toBe('weak_password');
    expect(checkCredentials('dana@example.com', '12345678')).toBeNull();
  });
  it('null password means "not checked" (forgot-password needs only the address)', () => {
    expect(checkCredentials('dana@example.com', null)).toBeNull();
  });
});

describe('every problem has words', () => {
  const problems = ['bad_login', 'not_confirmed', 'weak_password', 'bad_email', 'rate_limited', 'network', 'unknown'];
  it.each(problems)('%s', (p) => {
    const text = (UI as Record<string, { he: string; en: string }>)[`acct_err_${p}`];
    expect(text?.he).toBeTruthy();
    expect(text?.en).toBeTruthy();
  });
});

describe('accountFrom: what the header shows', () => {
  it('Google user: name and photo', () => {
    const a = accountFrom({ email: 'dana@gmail.com', user_metadata: { full_name: 'Dana Levi Cohen', avatar_url: 'https://x/p.jpg' }, app_metadata: { provider: 'google' } });
    expect(a).toEqual({ email: 'dana@gmail.com', name: 'Dana Levi Cohen', photo: 'https://x/p.jpg', google: true });
    expect(firstName(a!)).toBe('Dana');
    expect(initial(a!)).toBe('D');
  });
  it('falls back to name / picture when Google sends those keys instead', () => {
    expect(accountFrom({ email: 'a@b.co', user_metadata: { name: 'Avi', picture: 'https://x/q.jpg' } })).toEqual({
      email: 'a@b.co', name: 'Avi', photo: 'https://x/q.jpg', google: false,
    });
  });
  it('a Google login is told apart from an email login (settings depends on it)', () => {
    expect(accountFrom({ email: 'x@y.co', app_metadata: { provider: 'google' } })?.google).toBe(true);
    expect(accountFrom({ email: 'x@y.co', app_metadata: { provider: 'email' } })?.google).toBe(false);
  });
  it('email user: no name, no photo, initial from the address', () => {
    const a = accountFrom({ email: 'yosef@example.com', user_metadata: {} });
    expect(a).toEqual({ email: 'yosef@example.com', name: null, photo: null, google: false });
    expect(firstName(a!)).toBeNull();
    expect(initial(a!)).toBe('Y');
  });
  it('blank name is treated as no name', () => {
    expect(accountFrom({ email: 'z@z.co', user_metadata: { full_name: '   ' } })?.name).toBeNull();
  });
  it('Hebrew name keeps its first letter', () => {
    expect(initial(accountFrom({ email: 'h@h.co', user_metadata: { full_name: 'חיה רייכמן' } })!)).toBe('ח');
  });
  it('no session, or no email: logged out', () => {
    expect(accountFrom(null)).toBeNull();
    expect(accountFrom({ user_metadata: { full_name: 'X' } })).toBeNull();
  });
});

describe('linkProblem: coming back from a used or expired email link', () => {
  const base = 'http://localhost:5173/';
  it.each([
    // The exact shape Supabase sent on 2026-10-05, in the part after #.
    [base + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', 'expired'],
    [base + '?error=access_denied&error_code=otp_expired', 'expired'],
    [base + '#error_code=otp_expired', 'expired'],
    [base + '#error=server_error&error_code=unexpected_failure', 'other'],
    [base, null],
    [base + '#access_token=abc&type=recovery', null],
    [base + '?demo=roadmap', null],
  ] as const)('%s → %s', (href, want) => {
    expect(linkProblem(href)).toBe(want);
  });
});

describe('hasPassword: who may reset a password', () => {
  it('Google only: no password, so a reset link must not create one', () => {
    expect(hasPassword({ email: 'x@y.co', app_metadata: { provider: 'google', providers: ['google'] } })).toBe(false);
  });
  it('email + password: may reset', () => {
    expect(hasPassword({ email: 'x@y.co', app_metadata: { provider: 'email', providers: ['email'] } })).toBe(true);
  });
  it('both ways: may reset', () => {
    expect(hasPassword({ email: 'x@y.co', app_metadata: { provider: 'google', providers: ['google', 'email'] } })).toBe(true);
  });
  it('a future way alone (no email) may not', () => {
    expect(hasPassword({ email: 'x@y.co', app_metadata: { provider: 'apple', providers: ['apple'] } })).toBe(false);
  });
  it('no list: falls back to the main way; nobody logged in: no', () => {
    expect(hasPassword({ email: 'x@y.co', app_metadata: { provider: 'email' } })).toBe(true);
    expect(hasPassword(null)).toBe(false);
  });
});
