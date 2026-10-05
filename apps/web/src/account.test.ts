import { describe, expect, it } from 'vitest';
import { checkCredentials, problemFrom, MIN_PASSWORD } from './account';
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
