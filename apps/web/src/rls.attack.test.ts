/**
 * ⭐ The RLS attack test (M1 milestone 2, D-145).
 *
 * The site talks to the database with the PUBLIC key, so the database's own
 * rules (RLS) are the only thing keeping one person's immigration status from
 * another. This logs in as two real throwaway users against the real Supabase
 * project and has B try everything against A's case. Every attack must fail.
 *
 * Run: `npm run test:rls --workspace @byg/web`. Not part of `npm test`: it
 * needs the network and the two test users' passwords in `.env.test.local`
 * (gitignored). Without that file it skips rather than pretending to pass.
 */
/// <reference types="node" />
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const read = (f: string): Record<string, string> =>
  existsSync(f)
    ? Object.fromEntries(
        readFileSync(f, 'utf8')
          .split(/\r?\n/)
          .filter((l: string) => /^[A-Z_]+=/.test(l))
          .map((l: string) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
      )
    : {};
const env: Record<string, string> = { ...read('.env.local'), ...read('.env.test.local') };
const need = (k: string): string => env[k] ?? '';
const ready = Boolean(env.VITE_SUPABASE_URL && env.RLS_TEST_A_PASSWORD && env.RLS_TEST_B_PASSWORD);

const fresh = () =>
  createClient(need('VITE_SUPABASE_URL'), need('VITE_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

describe.skipIf(!ready)('RLS: user B against user A', () => {
  const a = fresh();
  const b = fresh();
  const anon = fresh();
  let aId = '';
  let bId = '';
  let aCase = '';
  let bCase = '';
  const secret = { visa_type: 'a2', marker: 'A-ONLY' };

  const login = async (c: SupabaseClient, who: 'A' | 'B') => {
    const { data, error } = await c.auth.signInWithPassword({
      email: need(`RLS_TEST_${who}_EMAIL`),
      password: need(`RLS_TEST_${who}_PASSWORD`),
    });
    if (error) throw error;
    return data.user.id;
  };

  beforeAll(async () => {
    aId = await login(a, 'A');
    bId = await login(b, 'B');
    const ra = await a.from('cases').insert({ answers: secret }).select('id').single();
    if (ra.error) throw ra.error;
    aCase = ra.data.id;
    const rb = await b.from('cases').insert({ answers: { visa_type: 'b1' } }).select('id').single();
    if (rb.error) throw rb.error;
    bCase = rb.data.id;
    await a.from('profiles').upsert({ user_id: aId, lang: 'en' });
  }, 30_000);

  afterAll(async () => {
    await a.from('cases').delete().eq('user_id', aId);
    await b.from('cases').delete().eq('user_id', bId);
  });

  it('A can read its own case (the lock is not just "deny everything")', async () => {
    const { data } = await a.from('cases').select('answers').eq('id', aCase).single();
    expect(data?.answers).toMatchObject({ marker: 'A-ONLY' });
  });

  it('B cannot read A’s case by its id', async () => {
    const { data } = await b.from('cases').select('*').eq('id', aCase);
    expect(data).toEqual([]);
  });

  it('B listing every case sees only its own', async () => {
    const { data } = await b.from('cases').select('id, user_id');
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((r) => r.user_id === bId)).toBe(true);
  });

  it('B cannot change A’s case', async () => {
    const { data } = await b.from('cases').update({ answers: { marker: 'B-WAS-HERE' } }).eq('id', aCase).select();
    expect(data ?? []).toEqual([]);
    const { data: after } = await a.from('cases').select('answers').eq('id', aCase).single();
    expect(after?.answers).toMatchObject({ marker: 'A-ONLY' });
  });

  it('B cannot delete A’s case', async () => {
    await b.from('cases').delete().eq('id', aCase);
    const { data } = await a.from('cases').select('id').eq('id', aCase);
    expect(data).toHaveLength(1);
  });

  it('B cannot create a case in A’s name', async () => {
    const { error } = await b.from('cases').insert({ user_id: aId, answers: {} });
    expect(error).not.toBeNull();
  });

  it('B cannot move its own case onto A', async () => {
    const { error } = await b.from('cases').update({ user_id: aId }).eq('id', bCase);
    expect(error).not.toBeNull();
    const { data } = await b.from('cases').select('user_id').eq('id', bCase).single();
    expect(data?.user_id).toBe(bId);
  });

  it('B cannot read A’s language', async () => {
    const { data } = await b.from('profiles').select('*').eq('user_id', aId);
    expect(data ?? []).toEqual([]);
  });

  it('logged out: no cases at all', async () => {
    const { data } = await anon.from('cases').select('id');
    expect(data ?? []).toEqual([]);
  });

  it('logged out: "delete my account" is refused (M1.4)', async () => {
    const { error } = await anon.rpc('delete_my_account');
    expect(error).not.toBeNull();
  });

  it('the database itself refuses a passport number, even from the owner', async () => {
    const { error } = await a.from('cases').insert({ answers: { passport_number: 'CD7654321' } });
    expect(error?.message ?? '').toMatch(/cases_no_document_numbers/);
    const { error: e2 } = await a.from('cases').insert({ answers: { foreign_license: { name_latin: 'OLEKSANDR' } } });
    expect(e2?.message ?? '').toMatch(/cases_no_document_numbers/);
  });
});
