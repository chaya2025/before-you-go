import { describe, it, expect } from 'vitest';
import { Condition, evaluateCondition, missingFacts, and, or, not, type Facts } from './condition';

/** A fully-answered person: ב/1 foreign worker, national licence, 3 years in. */
const known: Facts = {
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
};

/** The same person, except he skipped every optional question. */
const vague: Facts = {
  ...known,
  has_teudat_zehut: 'unknown',
  foreign_license_years: 'unknown',
  has_record_document: 'unknown',
  months_since_anchor: 'unknown',
  age_years: 'unknown',
};

describe('three-valued logic', () => {
  it('AND: one false decides it', () => {
    expect(and([true, false, 'unknown'])).toBe(false);
  });
  it('AND: without a false, ignorance wins', () => {
    expect(and([true, 'unknown'])).toBe('unknown');
  });
  it('OR: one true decides it', () => {
    expect(or([false, true, 'unknown'])).toBe(true);
  });
  it('OR: without a true, ignorance wins', () => {
    expect(or([false, 'unknown'])).toBe('unknown');
  });
  it('NOT: the opposite of "we do not know" is still "we do not know"', () => {
    expect(not('unknown')).toBe('unknown');
    expect(not(true)).toBe(false);
  });
});

describe('principle 8 — an unanswered question never becomes a no', () => {
  const needs89: Condition = { field: 'has_teudat_zehut', op: 'eq', value: false };

  it('applies the step when we know he has no teudat zehut', () => {
    expect(evaluateCondition(needs89, known)).toBe(true);
  });

  it('returns unknown, NOT false, when he never answered', () => {
    expect(evaluateCondition(needs89, vague)).toBe('unknown');
    // The distinction that matters: this step stays on his roadmap.
    expect(evaluateCondition(needs89, vague)).not.toBe(false);
  });

  it('a number comparison against an unanswered field is unknown, not out of range', () => {
    const exemption: Condition = { field: 'foreign_license_years', op: 'gte', value: 5 };
    expect(evaluateCondition(exemption, known)).toBe(true);
    expect(evaluateCondition(exemption, vague)).toBe('unknown');
  });
});

describe('real rules from the workbook', () => {
  it('the exemption: 5+ years on a permanent licence AND a רקורד — נוהל ס\' 2', () => {
    const exempt: Condition = {
      all: [
        { field: 'foreign_license_years', op: 'gte', value: 5 },
        { field: 'has_record_document', op: 'eq', value: 'yes' },
        // The exemption covers 176-180 only. C1 (תקנה 181) is outside it.
        { field: 'requested_class', op: 'in', value: ['A2', 'A1', 'A', '1', 'B'] },
      ],
    };
    expect(evaluateCondition(exempt, known)).toBe(true);
  });

  it('C1 always needs מבחן שליטה, even after twenty years — the 180 vs 181 gap', () => {
    const exempt: Condition = {
      all: [
        { field: 'foreign_license_years', op: 'gte', value: 5 },
        { field: 'has_record_document', op: 'eq', value: 'yes' },
        { field: 'requested_class', op: 'in', value: ['A2', 'A1', 'A', '1', 'B'] },
      ],
    };
    expect(evaluateCondition(exempt, { ...known, requested_class: 'C1', foreign_license_years: 20 })).toBe(false);
  });

  it('no exemption without a רקורד, however long he has held the licence', () => {
    const exempt: Condition = {
      all: [
        { field: 'foreign_license_years', op: 'gte', value: 5 },
        { field: 'has_record_document', op: 'eq', value: 'yes' },
      ],
    };
    expect(evaluateCondition(exempt, { ...known, has_record_document: 'no' })).toBe(false);
  });

  it('the grade ceiling: תושב מדינת חוץ cannot convert to bus or heavy truck — ס\' 1(ג)', () => {
    const blocked: Condition = {
      all: [
        { field: 'nohal_category', op: 'eq', value: 'toshav_medinat_chutz' },
        { field: 'requested_class', op: 'in', value: ['C', 'D', 'D1', 'D2', 'D3', 'E'] },
      ],
    };
    expect(evaluateCondition(blocked, { ...known, requested_class: 'D' })).toBe(true);
    expect(evaluateCondition(blocked, known)).toBe(false);
  });

  it('the two clocks are separate: past one year, still inside five', () => {
    const mayStillConvert: Condition = { field: 'months_since_anchor', op: 'lt', value: 60 };
    const mayStillDriveOnForeign: Condition = { field: 'months_since_anchor', op: 'lt', value: 12 };
    const atThreeYears = { ...known, months_since_anchor: 36 };
    expect(evaluateCondition(mayStillConvert, atThreeYears)).toBe(true);
    expect(evaluateCondition(mayStillDriveOnForeign, atThreeYears)).toBe(false);
  });

  it('the IDP trap', () => {
    const canConvert: Condition = { field: 'foreign_license_kind', op: 'eq', value: 'national' };
    expect(evaluateCondition(canConvert, { ...known, foreign_license_kind: 'idp_only' })).toBe(false);
  });
});

describe('is_known / is_unknown can answer even with nothing to go on', () => {
  it('asks about the gap itself', () => {
    expect(evaluateCondition({ field: 'age_years', op: 'is_unknown' }, vague)).toBe(true);
    expect(evaluateCondition({ field: 'age_years', op: 'is_known' }, vague)).toBe(false);
    expect(evaluateCondition({ field: 'age_years', op: 'is_known' }, known)).toBe(true);
  });
});

describe('an undecided step can say which answer would settle it', () => {
  it('names only the fields actually blocking a verdict', () => {
    const exempt: Condition = {
      all: [
        { field: 'foreign_license_years', op: 'gte', value: 5 },
        { field: 'has_record_document', op: 'eq', value: 'yes' },
        { field: 'visa_valid_now', op: 'eq', value: true },
      ],
    };
    expect(missingFacts(exempt, vague).sort()).toEqual([
      'foreign_license_years',
      'has_record_document',
    ]);
    expect(missingFacts(exempt, known)).toEqual([]);
  });
});

describe('conditions are data, so the data file validates them', () => {
  it('accepts a nested condition', () => {
    const raw = {
      all: [
        { field: 'has_teudat_zehut', op: 'eq', value: false },
        { any: [{ field: 'track', op: 'eq', value: 'from_zero' }, { field: 'track', op: 'eq', value: 'conversion' }] },
      ],
    };
    expect(Condition.safeParse(raw).success).toBe(true);
  });

  it('rejects a misspelled field, so a typo cannot become a rule that never fires', () => {
    const raw = { field: 'has_teudat_zehute', op: 'eq', value: false };
    expect(Condition.safeParse(raw).success).toBe(false);
  });

  it('rejects an invented operator', () => {
    const raw = { field: 'age_years', op: 'roughly', value: 24 };
    expect(Condition.safeParse(raw).success).toBe(false);
  });
});
