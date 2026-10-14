/**
 * ============================================================================
 * THE QUIET LIMIT — 6 document reads per user (M3 D-5, D-8)
 * ============================================================================
 *
 * ⭐ The counter lives in Supabase (`document_read`, migration 20261014180000).
 * This server holds no database key at all: it passes HIS login token along,
 * and Supabase works out who he is from it. An invalid or missing token is
 * refused by Supabase itself.
 *
 * ⚠️ The publishable key is public by design (the website ships it). It only
 * says which project; the token says who.
 */

export type Quota =
  | { status: 'ok'; user_id: string; allowed: boolean; left: number }
  | { status: 'no_login' }
  | { status: 'unavailable' };

export type QuotaFn = (token: string | undefined, consume: boolean) => Promise<Quota>;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

export const supabaseQuota: QuotaFn = async (token, consume) => {
  if (!token) return { status: 'no_login' };
  if (!url || !key) return { status: 'unavailable' };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/document_read`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ consume }),
    });
    if (res.status === 401 || res.status === 403) return { status: 'no_login' };
    if (!res.ok) {
      // "not logged in" raised inside the function arrives as a 400.
      const body = await res.text();
      return body.includes('not logged in') ? { status: 'no_login' } : { status: 'unavailable' };
    }
    const q = (await res.json()) as { user_id: string; allowed: boolean; left: number };
    return { status: 'ok', ...q };
  } catch {
    return { status: 'unavailable' };
  }
};

/** "Bearer abc" → "abc". */
export const bearer = (header: string | undefined) =>
  header?.startsWith('Bearer ') ? header.slice(7).trim() || undefined : undefined;
