import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { Profile, evaluate } from '@byg/engine';
import { distill, deterministicSummary, explain } from './explain';

/**
 * ============================================================================
 * THE LANGUAGE LAYER
 * ============================================================================
 *
 * ⚠️ These tests are almost entirely about what the model is NOT allowed to do.
 * That is the point of the layer. Hard rule 3 says the model does not make
 * critical decisions, and hard rule 1 says these users' documents do not leave
 * the server — a language layer is precisely where both of those get quietly
 * broken, because it is the only place anything is sent anywhere.
 */

const TODAY = '2026-08-31';

/** a real case: a stale 89 and a visa that has lapsed. */
const RAW = {
  visa_type: 'a2',
  has_teudat_zehut: false,
  teudat_zehut_confirmed: true,
  visa_valid_now: false,
  foreign_license: { kind: 'none' },
  form_89_number: '891234567',
  form_89_passport_number: 'AB1234567',
  passport_number: 'CD7654321',
  passport_name_latin: 'DANA LEVI',
  born: '2005-03',
};

const result = evaluate(Profile.parse(RAW), TODAY);

/** A stand-in for the SDK, so no test ever spends a credit. */
const fakeClient = (impl: () => unknown) =>
  ({ messages: { create: async () => impl() } }) as unknown as Anthropic;

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ what the model is allowed to see', () => {
  const payload = distill(result, 'he');

  /**
   * ⭐⭐ HARD RULE 1, checked rather than promised, at the only point in the
   * system where anything leaves the server. These users are legally
   * vulnerable and they are typing passport details into a form.
   *
   * The protection is structural: the payload is built only from Result
   * fields, and `npm run audit` already asserts as an invariant that no value
   * a user typed ever reaches a Result. This test holds the other end of that
   * guarantee at the network boundary.
   */
  it('⭐ carries no number or name the person typed', () => {
    for (const secret of ['891234567', 'AB1234567', 'CD7654321', 'DANA', 'LEVI']) {
      expect(payload).not.toContain(secret);
    }
  });

  /**
   * ⭐ HARD RULE 3. The model cannot rule on eligibility because it is never
   * given what it would need to try. It gets conclusions, not inputs.
   */
  it('⭐ carries no raw answer it could reason about, only conclusions', () => {
    expect(payload).not.toContain('2005-03');
    expect(payload).not.toContain('visa_type');
    // What it DOES get: the finished decision.
    expect(payload).toContain('DIAGNOSIS');
    expect(payload).toContain('from_zero');
  });

  /**
   * ⚠️ Severity travels with every notice. The founder's rule from 30.8 is the one
   * thing a cheerful rewrite is most likely to flatten, so the model is told
   * which is which on every single line rather than left to infer it.
   */
  it('labels every notice blocking or advisory', () => {
    for (const u of result.urgent) {
      expect(payload).toContain(`[${u.severity}]`);
    }
  });

  /**
   * ⭐ REGRESSION, 31.8, found by reading the first real Opus answer. The
   * exemption exists only on the conversion route, so the engine reports
   * 'unknown' for everyone going from zero — and sending that made the model
   * tell a from-zero applicant that we did not know whether he was exempt from
   * an eye test that has nothing to do with his route.
   */
  it('⭐ does not mention the exemption to somebody going from zero', () => {
    expect(result.diagnosis.track).toBe('from_zero');
    expect(payload).not.toContain('exempt from');
  });

  it('but does mention it to somebody converting, where it is real', () => {
    const converting = evaluate(
      Profile.parse({
        visa_type: 'b1',
        has_teudat_zehut: false,
        foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 7, held_class: 'B' },
        requested_class: 'B',
        entered_israel: '2024-01',
      }),
      TODAY,
    );
    expect(distill(converting, 'he')).toContain('exempt from');
  });

  it('carries the readiness verdict and the one thing to do first', () => {
    expect(payload).toContain('READINESS');
    expect(payload).toContain('THE ONE THING TO DO FIRST');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ the product with the model switched off', () => {
  /**
   * ⚠️ The whole reason the deterministic spine was built first. Days 1 to 4
   * ran with no key at all, and the demo must survive a key that is missing,
   * a credit that ran out, or a café wifi that dropped.
   */
  it('answers with real text when there is no key', async () => {
    const out = await explain(result, 'he', { client: null });
    expect(out.source).toBe('deterministic');
    expect(out.reason).toBe('no_key');
    expect(out.text.length).toBeGreaterThan(40);
  });

  it('answers with real text when the call throws', async () => {
    const out = await explain(result, 'he', {
      client: fakeClient(() => {
        throw new Error('402 no credit');
      }),
    });
    expect(out.source).toBe('deterministic');
    expect(out.reason).toBe('call_failed');
    expect(out.text.length).toBeGreaterThan(40);
  });

  /** ⚠️ An empty answer is a failure, not an answer. Never a blank panel. */
  it('answers with real text when the model returns nothing usable', async () => {
    const out = await explain(result, 'he', {
      client: fakeClient(() => ({ content: [] })),
    });
    expect(out.source).toBe('deterministic');
    expect(out.reason).toBe('empty_response');
    expect(out.text.length).toBeGreaterThan(40);
  });

  it('uses the model when the model works, and says that it did', async () => {
    const out = await explain(result, 'he', {
      client: fakeClient(() => ({ content: [{ type: 'text', text: 'שלום, זה מה שקורה.' }] })),
    });
    expect(out.source).toBe('model');
    expect(out.text).toBe('שלום, זה מה שקורה.');
    expect(out.reason).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('the deterministic text is a real answer, not an apology', () => {
  const he = deterministicSummary(result, 'he');
  const en = deterministicSummary(result, 'en');

  it('exists in both languages', () => {
    expect(he.length).toBeGreaterThan(40);
    expect(en.length).toBeGreaterThan(40);
  });

  it('leads with where he stands and names what to do first', () => {
    expect(he).toContain(result.readiness!.headline.he);
    expect(he).toContain(result.readiness!.first_action!.title.he);
  });

  /**
   * ⚠️ the founder, 30.8, and it survives all the way down here. An advisory is not
   * an alert. Even in the assembled fallback it is introduced as something
   * that does not stop him, because a person who reads a warning as a blocker
   * may not go at all and lose the days he still had.
   */
  it('⚠️ never presents an advisory as something that stops him', () => {
    const withAdvisory = evaluate(
      Profile.parse({ ...RAW, visa_valid_now: true, passport_expires: '2026-11' }),
      TODAY,
    );
    expect(withAdvisory.urgent.some((u) => u.severity === 'advisory')).toBe(true);
    expect(deterministicSummary(withAdvisory, 'he')).toContain('לא עוצר אותך');
  });

  it('says nothing about a person it has nothing to say about', () => {
    // A blocked person: the explanation IS the answer, and there is no road.
    const blocked = evaluate(
      Profile.parse({ visa_type: 'section_2a5', has_teudat_zehut: false, foreign_license: { kind: 'none' } }),
      TODAY,
    );
    expect(blocked.blocked).not.toBeNull();
    expect(deterministicSummary(blocked, 'he')).toBe(blocked.blocked!.blocker.explanation.he);
  });
});
