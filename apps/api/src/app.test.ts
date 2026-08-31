import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';

/**
 * ============================================================================
 * API TESTS
 * ============================================================================
 *
 * These run the whole API in memory. `app.inject()` is Fastify's way of handing
 * the server a request without a port, a socket or a network — so the tests are
 * fast, and nothing fights over port 3001.
 *
 * ⚠️ What they check is the CONTRACT, not the rules. The rules have 203 tests of
 * their own next door. What matters here is that the answer survives the trip
 * through HTTP unchanged, and that the two cases which must never be confused
 * still come out right on the far side.
 */

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const post = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/v1/readiness', payload: payload as object });

describe('the server is alive', () => {
  it('answers /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('/api/v1/statuses — so the website holds no domain knowledge', () => {
  it('lists every status with its label and its identity document', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/statuses' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.statuses.length).toBeGreaterThan(10);
    for (const s of body.statuses) {
      expect(s.value).toBeTruthy();
      expect(s.label.he).toBeTruthy();
      expect(s.label.en).toBeTruthy();
      expect(s.identity_document.he).toBeTruthy();
    }
  });

  it('says which statuses usually come with a teudat zehut, for the ש4 confirmation', async () => {
    const body = (await app.inject({ method: 'GET', url: '/api/v1/statuses' })).json();
    const a5 = body.statuses.find((s: { value: string }) => s.value === 'a5');
    const a2 = body.statuses.find((s: { value: string }) => s.value === 'a2');
    expect(a5.usually_has_teudat_zehut).toBe(true);
    expect(a2.usually_has_teudat_zehut).toBe(false);
  });

  it('hands over the licence classes, so the form does not hardcode them', async () => {
    const body = (await app.inject({ method: 'GET', url: '/api/v1/statuses' })).json();
    expect(body.license_classes).toContain('B');
    expect(body.license_classes).toContain('C1');
  });
});

describe('/api/v1/readiness — the answer survives the trip through HTTP', () => {
  it('returns a roadmap for a valid profile', async () => {
    const res = await post({
      visa_type: 'a2',
      visa_valid_now: true,
      foreign_license: { kind: 'none' },
      has_teudat_zehut: false,
      born: '2005-01',
      today: '2026-08-26',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.blocked).toBeNull();
    expect(body.diagnosis.track).toBe('from_zero');
    expect(body.roadmap.length).toBeGreaterThan(0);
    expect(body.roadmap[0].step.title.he).toBeTruthy();
  });

  it('⭐ 2(א)(5) comes back BLOCKED, with the reason and the referrals', async () => {
    const res = await post({
      visa_type: 'section_2a5',
      foreign_license: { kind: 'none' },
      has_teudat_zehut: false,
      today: '2026-08-26',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.blocked).not.toBeNull();
    expect(body.blocked.blocker.id).toBe('block.section_2a5');
    expect(body.roadmap).toEqual([]);
    // Never a dead end, even through the wire.
    expect(body.blocked.blocker.referrals.length).toBeGreaterThan(0);
    expect(body.blocked.blocker.explanation.he).toContain('בג"ץ');
  });

  it('⭐ א/5 does NOT come back blocked, and keeps its 176-181 ceiling', async () => {
    // The two that must never be confused, checked on the far side of HTTP too.
    const res = await post({
      visa_type: 'a5',
      visa_valid_now: true,
      has_teudat_zehut: true,
      foreign_license: {
        kind: 'national',
        valid_now: true,
        years_held_permanent: 7,
        held_class: 'B',
      },
      requested_class: 'B',
      has_record_document: 'yes',
      entered_israel: '2024-01',
      born: '1990-05',
      today: '2026-08-26',
    });
    const body = res.json();
    expect(body.blocked).toBeNull();
    expect(body.diagnosis.grade_ceiling).toEqual({ from: 176, to: 181 });
    expect(body.roadmap.length).toBeGreaterThan(0);
  });

  it('builds a roadmap from the two required answers alone, marking the rest uncertain', async () => {
    const res = await post({
      visa_type: 'b1',
      foreign_license: { kind: 'national' },
      today: '2026-08-26',
    });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.roadmap.length).toBeGreaterThan(0);
    expect(body.roadmap.some((s: { applies: unknown }) => s.applies === 'unknown')).toBe(true);
  });

  it('computes the two clocks separately — expired to drive, still open to convert', async () => {
    const res = await post({
      visa_type: 'a5',
      has_teudat_zehut: true,
      foreign_license: { kind: 'national', years_held_permanent: 7 },
      entered_israel: '2024-01',
      today: '2026-08-26',
    });
    const clocks: Record<string, { status: string }> = Object.fromEntries(
      res.json().clocks.map((c: { clock: { id: string } }) => [c.clock.id, c]),
    );
    expect(clocks['clock.foreign_driving']!.status).toBe('expired');
    expect(clocks['clock.conversion_window']!.status).toBe('running');
  });
});

describe('bad input is refused in a way the form can act on', () => {
  it('names the offending FIELD, so the form can point at the question', async () => {
    const res = await post({ visa_type: 'not_a_real_visa', foreign_license: { kind: 'none' } });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error).toBe('invalid profile');
    expect(body.issues.some((i: { field: string }) => i.field === 'visa_type')).toBe(true);
  });

  it('refuses a profile missing the two required answers', async () => {
    const res = await post({ visa_valid_now: true });
    expect(res.statusCode).toBe(422);
  });

  it('falls back to today when the date is nonsense, rather than crashing', async () => {
    const res = await post({
      visa_type: 'b1',
      foreign_license: { kind: 'none' },
      today: 'yesterday-ish',
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('privacy — hard rule 1', () => {
  it('sets no cookie and returns no identifier', async () => {
    const res = await post({
      visa_type: 'a2',
      foreign_license: { kind: 'none' },
      has_teudat_zehut: false,
      today: '2026-08-26',
    });
    // Nothing that could tie a result back to a person or a session.
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).not.toMatch(/"(session|user_id|tracking_id)"\s*:/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('the readiness report survives the trip through HTTP', () => {
  /** Chaya's own case: a stale 89 and a visa that has lapsed. */
  const stale = {
    today: '2026-08-31',
    visa_type: 'a2',
    has_teudat_zehut: false,
    teudat_zehut_confirmed: true,
    visa_valid_now: false,
    foreign_license: { kind: 'none' },
    form_89_number: '891234567',
    form_89_passport_number: 'AB1234567',
    passport_number: 'CD7654321',
    born: '2005-03',
  };

  it('comes back with a verdict, a headline and one thing to do first', async () => {
    const res = await post(stale);
    expect(res.statusCode).toBe(200);
    const r = res.json().readiness;
    expect(r.verdict).toBe('mismatch');
    expect(r.headline.he).toBeTruthy();
    expect(r.headline.en).toBeTruthy();
    expect(r.first_action.step_id).toBe('fix.renew_visa');
  });

  it('carries all four buckets, so the website never has to infer one', async () => {
    const r = (await post(stale)).json().readiness;
    for (const bucket of ['ready', 'mismatched', 'missing', 'unconfirmed']) {
      expect(Array.isArray(r[bucket])).toBe(true);
    }
    expect(r.mismatched.map((i: { id: string }) => i.id)).toContain('doc.form_89');
  });

  /**
   * ⚠️ PRIVACY, hard rule 1, checked at the edge as well as in the engine. The
   * report is the newest thing that handles document numbers, and it is also
   * the most quotable part of the answer — a mismatch that named the number
   * would put it in every screenshot a user sends to a friend.
   */
  it('never echoes back a number he typed', async () => {
    const body = (await post(stale)).body;
    expect(body).not.toContain('891234567');
    expect(body).not.toContain('AB1234567');
    expect(body).not.toContain('CD7654321');
  });

  /**
   * ⚠️ NULL for a blocked person, not an empty report. Four empty lists would
   * compute the verdict 'ready' and tell a man who cannot proceed at all that
   * he is good to go.
   */
  it('is absent for a blocked person rather than empty', async () => {
    const res = await post({
      today: '2026-08-31',
      visa_type: 'section_2a5',
      has_teudat_zehut: false,
      foreign_license: { kind: 'none' },
    });
    expect(res.json().blocked).not.toBeNull();
    expect(res.json().readiness).toBeNull();
  });
});
