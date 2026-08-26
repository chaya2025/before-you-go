import { describe, it, expect } from 'vitest';
import { Profile, checkProfile, canBuildRoadmap } from './profile';

const TODAY = '2026-08-25';

/** Chaya's own case: א/2 student, no teudat zehut, no foreign licence, under 24. */
const chayaCase = Profile.parse({
  language: 'he',
  visa_type: 'a2',
  visa_valid_now: true,
  foreign_license: { kind: 'none' },
  has_teudat_zehut: false,
  teudat_zehut_confirmed: true,
  born: '2005-01',
});

describe('unknown is a real answer, never a silent no', () => {
  it('defaults every optional answer to "unknown" rather than to false', () => {
    const bare = Profile.parse({
      visa_type: 'b1',
      foreign_license: { kind: 'national' },
    });
    expect(bare.has_teudat_zehut).toBe('unknown');
    expect(bare.visa_valid_now).toBe('unknown');
    expect(bare.has_record_document).toBe('unknown');
    expect(bare.born).toBe('unknown');
    expect(bare.foreign_license.years_held_permanent).toBe('unknown');
  });

  it('keeps "my country does not issue a רקורד" separate from a plain no', () => {
    const p = Profile.parse({
      visa_type: 'b1',
      foreign_license: { kind: 'national' },
      has_record_document: 'origin_country_does_not_issue',
    });
    expect(p.has_record_document).toBe('origin_country_does_not_issue');
    expect(p.has_record_document).not.toBe('no');
  });
});

describe('א/5 and 2(א)(5) are different values and cannot be confused', () => {
  it('accepts both, as distinct codes', () => {
    expect(Profile.parse({ visa_type: 'a5', foreign_license: { kind: 'national' } }).visa_type).toBe('a5');
    expect(Profile.parse({ visa_type: 'section_2a5', foreign_license: { kind: 'none' } }).visa_type).toBe('section_2a5');
  });

  it('holds the teudat zehut answer separately from the visa type, so eligibility is never derived from the channel', () => {
    const a5 = Profile.parse({
      visa_type: 'a5',
      foreign_license: { kind: 'national' },
      has_teudat_zehut: true,
      teudat_zehut_confirmed: true,
    });
    // He has an ID. That decides the channel. It says nothing about his grade ceiling.
    expect(a5.has_teudat_zehut).toBe(true);
    expect(a5.visa_type).toBe('a5');
  });
});

describe('the IDP trap is its own answer, not a kind of licence', () => {
  it('records "international permit only" distinctly from having a licence', () => {
    const p = Profile.parse({ visa_type: 'b1', foreign_license: { kind: 'idp_only' } });
    expect(p.foreign_license.kind).toBe('idp_only');
    expect(p.foreign_license.kind).not.toBe('national');
  });
});

describe('F1 rule 6 — only ש1 and ש2 gate the roadmap', () => {
  it('builds a roadmap with everything else unknown', () => {
    const p = Profile.parse({ visa_type: 'b1', foreign_license: { kind: 'national' } });
    expect(canBuildRoadmap(p)).toBe(true);
  });

  it('waits when the user does not know his status', () => {
    const p = Profile.parse({ visa_type: 'unsure', foreign_license: { kind: 'national' } });
    expect(canBuildRoadmap(p)).toBe(false);
  });

  it('waits when the licence question is unanswered', () => {
    const p = Profile.parse({ visa_type: 'b1', foreign_license: { kind: 'unknown' } });
    expect(canBuildRoadmap(p)).toBe(false);
  });
});

describe('consistency checks warn, they never block', () => {
  it('is quiet on a coherent profile', () => {
    expect(checkProfile(chayaCase, TODAY)).toEqual([]);
  });

  it('flags a future entry date without rejecting the profile', () => {
    const p = Profile.parse({
      visa_type: 'b1',
      foreign_license: { kind: 'national' },
      entered_israel: '2027-01',
    });
    const warnings = checkProfile(p, TODAY);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.field).toBe('entered_israel');
  });

  it('flags licence seniority impossible for the age, and asks rather than refuses', () => {
    const p = Profile.parse({
      visa_type: 'b1',
      born: '2005-01', // 21
      foreign_license: { kind: 'national', years_held_permanent: 12 },
    });
    const warnings = checkProfile(p, TODAY);
    expect(warnings.map((w) => w.field)).toContain('foreign_license.years_held_permanent');
    expect(warnings[0]!.message_en).toContain('Confirm or correct');
  });

  it('says nothing about seniority when the age is unknown', () => {
    const p = Profile.parse({
      visa_type: 'b1',
      foreign_license: { kind: 'national', years_held_permanent: 12 },
    });
    expect(checkProfile(p, TODAY)).toEqual([]);
  });
});

describe('the three clock anchors are separate fields', () => {
  it('does not collapse entry, aliyah and return into one date', () => {
    const p = Profile.parse({
      visa_type: 'a1',
      foreign_license: { kind: 'national' },
      made_aliyah: '2024-03',
    });
    expect(p.made_aliyah).toBe('2024-03');
    expect(p.entered_israel).toBe('unknown');
    expect(p.returned_to_israel).toBe('unknown');
  });
});
