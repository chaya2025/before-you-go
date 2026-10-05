import { describe, expect, it } from 'vitest';
import type { Result } from '@byg/engine';
import { addMonths, applyRenewal, staleDocs, whatChanged } from './stale';

// Today is 15 Oct 2026 in every test, so nothing depends on the real clock.
const TODAY = new Date(2026, 9, 15);
const AUG = new Date(2026, 7, 20); // confirmed in August

describe('addMonths', () => {
  it.each([
    ['2026-10', 2, '2026-12'],
    ['2026-11', 2, '2027-01'],
    ['2026-12', 1, '2027-01'],
    ['2027-01', -1, '2026-12'],
  ] as const)('%s + %i = %s', (ym, n, want) => expect(addMonths(ym, n)).toBe(want));
});

describe('staleDocs: what gets asked before the road', () => {
  it('a visa valid when he confirmed (Aug) and lapsed by today (Oct) is asked as expired', () => {
    expect(staleDocs({ visa_expires: '2026-09' }, AUG, TODAY)).toEqual([
      { field: 'visa_expires', expires: '2026-09', kind: 'expired' },
    ]);
  });
  it('the month he confirmed in counts: valid that month, lapsed since', () => {
    expect(staleDocs({ visa_expires: '2026-08' }, AUG, TODAY)).toHaveLength(1);
  });
  it('already expired when he confirmed is NOT asked again (he told us)', () => {
    expect(staleDocs({ visa_expires: '2026-07' }, AUG, TODAY)).toEqual([]);
  });
  it('expiring this month or the next two is asked as "soon"', () => {
    expect(staleDocs({ passport_expires: '2026-10' }, AUG, TODAY)[0]?.kind).toBe('soon');
    expect(staleDocs({ passport_expires: '2026-12' }, AUG, TODAY)[0]?.kind).toBe('soon');
  });
  it('three months out is not asked', () => {
    expect(staleDocs({ passport_expires: '2027-01' }, AUG, TODAY)).toEqual([]);
  });
  it('the licence expiry is read from inside foreign_license', () => {
    expect(staleDocs({ foreign_license: { kind: 'permanent', expires: '2026-09' } }, AUG, TODAY)).toEqual([
      { field: 'license_expires', expires: '2026-09', kind: 'expired' },
    ]);
  });
  it('no licence held: its expiry is never asked about', () => {
    expect(staleDocs({ foreign_license: { kind: 'none', expires: '2026-09' } }, AUG, TODAY)).toEqual([]);
  });
  it('unknown or malformed dates are skipped, never guessed', () => {
    expect(staleDocs({ visa_expires: 'unknown', passport_expires: '2026-9' }, AUG, TODAY)).toEqual([]);
  });
  it('all three at once, in a fixed order: visa, passport, licence', () => {
    const r = staleDocs(
      { visa_expires: '2026-09', passport_expires: '2026-11', foreign_license: { kind: 'permanent', expires: '2026-08' } },
      AUG,
      TODAY,
    );
    expect(r.map((d) => [d.field, d.kind])).toEqual([
      ['visa_expires', 'expired'],
      ['passport_expires', 'soon'],
      ['license_expires', 'expired'],
    ]);
  });
});

describe('applyRenewal', () => {
  const a = { visa_type: 'a2', visa_expires: '2026-09', visa_valid_now: true, foreign_license: { kind: 'permanent', expires: '2026-09' } };
  it('visa renewed: new date and valid again', () => {
    expect(applyRenewal(a, 'visa_expires', '2027-09')).toMatchObject({ visa_expires: '2027-09', visa_valid_now: true });
  });
  it('visa NOT renewed: marked not valid, so the engine puts it first', () => {
    expect(applyRenewal(a, 'visa_expires', null)).toMatchObject({ visa_expires: '2026-09', visa_valid_now: false });
  });
  it('licence renewed: only the nested date moves, the kind stays', () => {
    expect(applyRenewal(a, 'license_expires', '2031-01').foreign_license).toEqual({ kind: 'permanent', expires: '2031-01' });
  });
  it('passport not renewed: nothing changes (an expired date already reads as expired)', () => {
    expect(applyRenewal(a, 'passport_expires', null)).toEqual(a);
  });
  it('never edits the answers it was given', () => {
    const copy = JSON.parse(JSON.stringify(a));
    applyRenewal(a, 'visa_expires', '2027-09');
    expect(a).toEqual(copy);
  });
});

const step = (id: string) => ({ step: { id } });
const res = (o: { track?: string; steps?: string[]; urgent?: string[]; blocked?: boolean }) =>
  ({
    diagnosis: { track: o.track ?? 'from_zero' },
    roadmap: (o.steps ?? []).map(step),
    urgent: (o.urgent ?? []).map((id) => ({ id })),
    blocked: o.blocked ? { blocker: {} } : null,
  }) as unknown as Result;

describe('whatChanged: what moved, and the answer that moved it', () => {
  it('visa type change that moves the route names the cause and the route', () => {
    const c = whatChanged(
      res({ track: 'from_zero', steps: ['a', 'b'] }),
      res({ track: 'conversion', steps: ['a', 'c'] }),
      { visa_type: 'a2' },
      { visa_type: 'a5' },
    );
    expect(c).toMatchObject({
      causes: [{ field: 'visa_type', from: 'a2', to: 'a5' }],
      trackFrom: 'from_zero',
      trackTo: 'conversion',
      stepsAdded: ['c'],
      stepsRemoved: ['b'],
    });
  });
  it('the route alone changing (same step ids) is still reported', () => {
    const c = whatChanged(res({ track: 'from_zero', steps: ['a'] }), res({ track: 'conversion', steps: ['a'] }), { visa_type: 'a2' }, { visa_type: 'a5' });
    expect([c?.trackFrom, c?.trackTo]).toEqual(['from_zero', 'conversion']);
  });
  it('a lapsed visa appearing as urgent is reported', () => {
    const c = whatChanged(res({ steps: ['a'] }), res({ steps: ['a'], urgent: ['visa_lapsed'] }), { visa_valid_now: true }, { visa_valid_now: false });
    expect(c?.urgentAdded).toEqual(['visa_lapsed']);
    expect(c?.causes).toEqual([{ field: 'visa_valid_now', from: true, to: false }]);
  });
  it('blocked and unblocked are reported both ways', () => {
    expect(whatChanged(res({}), res({ blocked: true }), {}, {})?.blockedNow).toBe(true);
    expect(whatChanged(res({ blocked: true }), res({}), {}, {})?.unblocked).toBe(true);
  });
  it('an answer changed but the road did not move: nothing to report (null), not noise', () => {
    expect(whatChanged(res({ steps: ['a'] }), res({ steps: ['a'] }), { passport_expires: '2026-10' }, { passport_expires: '2031-10' })).toBeNull();
  });
  it('the licence date is compared from inside foreign_license', () => {
    const c = whatChanged(res({ steps: ['a'] }), res({ steps: ['a', 'x'] }), { foreign_license: { expires: '2026-09' } }, { foreign_license: { expires: '2031-01' } });
    expect(c?.causes).toEqual([{ field: 'license_expires', from: '2026-09', to: '2031-01' }]);
  });
});
