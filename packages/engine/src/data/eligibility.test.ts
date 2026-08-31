import { describe, it, expect } from 'vitest';
import { VisaType } from '../profile';
import { evaluateCondition, type Facts } from '../condition';
import { FOREIGN_RESIDENT_CEILING } from '../domain';
import {
  ALL_VISA_PROFILES,
  ALL_CATEGORY_RULES,
  ALL_BLOCKERS,
  visaProfileFor,
  categoryRuleFor,
} from './index';

const baseFacts: Facts = {
  visa_type: 'b1',
  has_teudat_zehut: false,
  visa_valid_now: true,
  foreign_license_kind: 'national',
  foreign_license_valid: true,
  foreign_license_years: 7,
  held_class: 'B',
  requested_class: 'B',
  has_record_document: 'yes',
  lived_abroad_6_months_continuous: 'unknown',
  origin_country: 'Ukraine',
  nohal_category: 'toshav_medinat_chutz',
  track: 'conversion',
  months_since_anchor: 36,
  age_years: 34,
  months_until_visa_expiry: 18,
  // No documents transcribed in the base fixture, which is the honest default:
  // nothing entered can never become a mismatch.
  passport_valid_now: 'unknown',
  months_until_passport_expiry: 'unknown',
  passport_89_number_match: 'unknown',
  passport_89_name_match: 'unknown',
  passport_license_name_match: 'unknown',
  months_until_license_expiry: 'unknown',
  foreign_license_language: 'unknown',
  holds_form_89: 'unknown',
};

describe('completeness — nobody falls through the gaps', () => {
  it('every status the intake form offers has a profile', () => {
    // 'unsure' is the "I do not know" answer, not a status. F1 rule 6 blocks
    // the roadmap on it rather than mapping it.
    const answerable = VisaType.options.filter((v) => v !== 'unsure');
    for (const visa of answerable) {
      expect(visaProfileFor(visa), `no profile for ${visa}`).toBeDefined();
    }
  });

  it('every category a status points at actually exists', () => {
    for (const profile of ALL_VISA_PROFILES) {
      expect(categoryRuleFor(profile.nohal_category), profile.visa_type).toBeDefined();
    }
  });

  it('every status and category cites a source', () => {
    for (const p of ALL_VISA_PROFILES) expect(p.evidence.length, p.visa_type).toBeGreaterThan(0);
    for (const c of ALL_CATEGORY_RULES) expect(c.evidence.length, c.category).toBeGreaterThan(0);
  });
});

describe('⭐ the two axes stay separate — the highest-consequence rule in the system', () => {
  it('א/5 holds a teudat zehut AND is still a foreign resident', () => {
    const a5 = visaProfileFor('a5')!;
    // The channel axis: he has an ID, so online.
    expect(a5.usually_has_teudat_zehut).toBe(true);
    // The eligibility axis: unchanged by that.
    expect(a5.nohal_category).toBe('toshav_medinat_chutz');
  });

  it('so א/5 is capped at 176-181 despite holding an ID', () => {
    const rule = categoryRuleFor(visaProfileFor('a5')!.nohal_category)!;
    expect(rule.grade_ceiling).toEqual(FOREIGN_RESIDENT_CEILING);
  });

  it('holding a teudat zehut does not by itself grant the wider ceiling', () => {
    const withId = ALL_VISA_PROFILES.filter((p) => p.usually_has_teudat_zehut === true);
    const categories = new Set(withId.map((p) => p.nohal_category));
    // Both א/5 (foreign resident) and תושב קבע (Israeli resident) hold an ID.
    // If the ID decided eligibility, these would be one category. They are not.
    expect(categories.size).toBeGreaterThan(1);
  });

  it('א/5 carries a caveat spelling the split out to the user', () => {
    expect(visaProfileFor('a5')!.caveat!.he).toContain('176-181');
  });
});

describe('⚠️ א/5 and 2(א)(5) — telling these apart is the worst mistake available', () => {
  const isBlocked = (visa_type: string) =>
    ALL_BLOCKERS.some((b) => evaluateCondition(b.applies_when, { ...baseFacts, visa_type } as Facts) === true);

  it('א/5 is NOT blocked', () => {
    // Blocking a fully eligible temporary resident is the worst output this
    // product can produce. This test exists to make that impossible to ship.
    expect(isBlocked('a5')).toBe(false);
  });

  it('2(א)(5) IS blocked', () => {
    expect(isBlocked('section_2a5')).toBe(true);
  });

  it('no other status is blocked — not even one without a teudat zehut', () => {
    const blocked = VisaType.options.filter((v) => v !== 'unsure' && isBlocked(v));
    expect(blocked).toEqual(['section_2a5']);
  });
});

describe('the anchor differs by category, and they are not interchangeable', () => {
  it('עולה counts from aliyah, תושב ישראל from return, תושב מדינת חוץ from entry', () => {
    expect(categoryRuleFor('oleh_chadash')!.window_anchor).toBe('aliyah');
    expect(categoryRuleFor('toshav_israel')!.window_anchor).toBe('return');
    expect(categoryRuleFor('toshav_medinat_chutz')!.window_anchor).toBe('entry');
  });

  it('all three defined categories get five years', () => {
    for (const c of ['oleh_chadash', 'toshav_israel', 'toshav_medinat_chutz'] as const) {
      expect(categoryRuleFor(c)!.conversion_window_years, c).toBe(5);
    }
  });

  it('a status the procedure does not cover gets no window and no ceiling, rather than a guess', () => {
    const undefined_ = categoryRuleFor('not_defined_in_nohal')!;
    expect(undefined_.conversion_window_years).toBeUndefined();
    expect(undefined_.grade_ceiling).toBeUndefined();
    expect(undefined_.extra_requirements[0]!.he).toContain('לא יודעים');
  });
});

describe('the grade ceiling', () => {
  it('a foreign resident stops at 181 — no bus, no heavy truck, ever', () => {
    expect(categoryRuleFor('toshav_medinat_chutz')!.grade_ceiling).toEqual({ from: 176, to: 181 });
  });

  it('an עולה and a returning resident reach 185, with extra requirements attached', () => {
    for (const c of ['oleh_chadash', 'toshav_israel'] as const) {
      expect(categoryRuleFor(c)!.grade_ceiling!.to, c).toBe(185);
    }
    expect(categoryRuleFor('oleh_chadash')!.extra_requirements[0]!.he).toContain('182-185');
  });
});

describe('the ב/2 tourist trap is recorded where the user will see it', () => {
  it('warns that the real window is the visa, not the five years', () => {
    const b2 = visaProfileFor('b2')!;
    expect(b2.caveat!.he).toContain('שלושה חודשים');
    expect(b2.caveat!.en).toContain('whatever is left on your visa');
  });
});

describe('the 2(א)(5) blocker', () => {
  const blocker = ALL_BLOCKERS.find((b) => b.id === 'block.section_2a5')!;

  it('is the only blocker in the system', () => {
    // Missing a teudat zehut changes the channel, never the entitlement.
    expect(ALL_BLOCKERS).toHaveLength(1);
  });

  it('⭐ flips with one field, so a court ruling costs one edit', () => {
    expect(blocker.legal_status).toBe('in_litigation');
    expect(['active', 'in_litigation', 'lifted']).toContain(blocker.legal_status);
    expect(blocker.expected_resolution_at).toBe('2026-10-10');
  });

  it('never delivers a bare "you are not eligible"', () => {
    expect(blocker.explanation.he).not.toContain('אינך זכאי');
    expect(blocker.explanation.en.toLowerCase()).not.toContain('you are not eligible');
  });

  it('says the prohibition comes from a service page, not from the procedure or the regulations', () => {
    expect(blocker.explanation.he).toContain('אינו כתוב בנוהל');
    expect(blocker.explanation.he).toContain('אינו כתוב בתקנות התעבורה');
  });

  it('explains the legal reasoning instead of decreeing it', () => {
    expect(blocker.explanation.he).toContain('בלי רישיון ישיבה');
  });

  it('tells him the matter is live in court, and when to look again', () => {
    expect(blocker.explanation.he).toContain('בג"ץ');
    expect(blocker.evidence.some((e) => e.certainty === 'in_litigation')).toBe(true);
  });

  it('is never a dead end — it hands him organisations that can help', () => {
    expect(blocker.referrals.length).toBeGreaterThan(0);
    for (const r of blocker.referrals) expect(r.url).toBeTruthy();
  });

  it('limits its own scope to driving licences', () => {
    expect(blocker.explanation.he).toContain('שאר תהליכי הקליטה');
  });

  it('marks the press report as the weak link that it is', () => {
    const press = blocker.evidence.find((e) => e.citation?.includes('וואלה'))!;
    expect(press.citation).toContain('מקור עיתונאי');
  });
});
