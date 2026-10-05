import { describe, expect, it } from 'vitest';
import { Profile, ForeignLicense } from '@byg/engine';
import type { Result } from '@byg/engine';
import { NEVER_STORED, NEVER_STORED_IN_LICENSE, storable } from './account';
import { summarize } from './components/CaseBar';

/**
 * ⚠️ The never-stored list is a blocklist, so a NEW engine field would be
 * saved by default. This pins every field the engine accepts today to a
 * decision: stored, or never stored. A new field fails here until someone
 * decides which it is.
 */
const STORED = [
  'language', 'visa_type', 'visa_valid_now', 'visa_expires', 'foreign_license', 'entered_israel',
  'made_aliyah', 'returned_to_israel', 'lived_abroad_6_months_continuous', 'has_teudat_zehut',
  'teudat_zehut_confirmed', 'requested_class', 'has_record_document', 'born', 'holds_form_89',
  'passport_expires', 'completed_steps',
];
const LICENSE_STORED = ['kind', 'valid_now', 'years_held_permanent', 'held_class', 'country', 'expires', 'language'];

describe('every engine field has a storage decision', () => {
  it('profile', () => {
    expect(Object.keys(Profile.shape).sort()).toEqual([...STORED, ...NEVER_STORED].sort());
  });
  it('foreign licence', () => {
    expect(Object.keys(ForeignLicense.shape).sort()).toEqual([...LICENSE_STORED, ...NEVER_STORED_IN_LICENSE].sort());
  });
});

describe('storable', () => {
  const full = {
    visa_type: 'a2',
    born: '2005-01',
    passport_number: 'CD7654321',
    form_89_number: '12345',
    form_89_passport_number: 'AB1234567',
    passport_name_latin: 'OLEKSANDR',
    form_89_name_latin: 'OLEXANDR',
    completed_steps: ['x'],
    foreign_license: { kind: 'permanent', name_latin: 'OLEKSANDR', expires: '2030-01' },
  };
  it('drops every document number and name, keeps the rest', () => {
    expect(storable(full)).toEqual({
      visa_type: 'a2',
      born: '2005-01',
      foreign_license: { kind: 'permanent', expires: '2030-01' },
    });
  });
  it('does not touch the answers it was given (the screen still has them)', () => {
    const copy = JSON.parse(JSON.stringify(full));
    storable(full);
    expect(full).toEqual(copy);
  });
});

const step = (id: string, state: string) => ({ step: { id, title: { he: id, en: id } }, state }) as never;
const clock = (id: string, status: string, days: number | null, warning = false) =>
  ({ clock: { id, name: { he: id, en: id } }, status, days_left: days, deadline: days === null ? null : '2026-11-01', warning }) as never;

describe('summarize: the welcome-back card', () => {
  const result = {
    roadmap: [step('s1', 'done'), step('s2', 'done'), step('s2w', 'waiting_on'), step('s3', 'do_now'), step('s4', 'do_now'), step('s5', 'later')],
    clocks: [clock('far', 'running', 200), clock('near', 'running', 40), clock('gone', 'expired', -5), clock('nodate', 'unknown', null)],
  } as unknown as Result;

  it('counts, and names the FIRST step he can act on (where he lands)', () => {
    const s = summarize(result);
    expect([s.done, s.total, s.next?.step.id]).toEqual([2, 6, 's3']);
  });
  it('nearest deadline: the running clock with the fewest days, never an expired or dateless one', () => {
    expect(summarize(result).nearest?.clock.id).toBe('near');
  });
  it('nothing to act on and no running clock: both empty, not invented', () => {
    const s = summarize({ roadmap: [step('a', 'done')], clocks: [clock('x', 'unknown', null)] } as unknown as Result);
    expect([s.next, s.nearest]).toEqual([null, null]);
  });
});
