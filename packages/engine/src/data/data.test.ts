import { describe, it, expect } from 'vitest';
import { Step, CheckedStep } from '../domain';
import { Condition, evaluateCondition, type Facts } from '../condition';
import { ALL_STEPS } from './index';

const stepById = (id: string) => {
  const step = ALL_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`No step "${id}"`);
  return step;
};

/** A veteran driver converting: ב/1, seven years on a permanent B licence, has a רקורד. */
const veteranConverter: Facts = {
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

/**
 * ============================================================================
 * DATA INTEGRITY
 * ============================================================================
 *
 * These tests do not check that the licence rules are CORRECT — no test can do
 * that, only the נוהל can. They check that the data file is well formed and
 * that the research standards hold across every row without exception.
 *
 * This is the Day 1 deliverable: something green before an engine exists.
 */

describe('every step parses against the schema', () => {
  it.each(ALL_STEPS.map((s) => [s.id, s] as const))('%s', (_id, step) => {
    const result = Step.safeParse(step);
    if (!result.success) {
      throw new Error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});

describe('traceability — hard rule 4, no exceptions', () => {
  it('every step cites at least one source', () => {
    for (const step of ALL_STEPS) {
      expect(step.evidence.length, `${step.id} has no evidence`).toBeGreaterThan(0);
    }
  });

  it('every claim marked verified carries the source\'s own words and a citation', () => {
    for (const step of ALL_STEPS) {
      for (const part of step.evidence) {
        if (part.certainty === 'verified') {
          expect(part.quote, `${step.id}: verified claim with no quote`).toBeTruthy();
          expect(part.citation, `${step.id}: verified claim with no citation`).toBeTruthy();
        }
      }
    }
  });

  it('every cost that is shown is itself sourced', () => {
    for (const step of ALL_STEPS) {
      if (step.cost) {
        expect(step.cost.evidence.length, `${step.id}: cost with no evidence`).toBeGreaterThan(0);
      }
    }
  });

  it('⭐ a field report IS evidence — four steps rest on nothing else, and they are the point', () => {
    // Chaya, 2026-08-25, asking whether a 🔵 step counts as sourced. It does.
    // The היתר, its fee, the completion declaration and the plastic-card fee are
    // documented in no official source anywhere. They still happen. Demanding a
    // government citation would delete exactly the steps nobody else can tell you.
    const fieldOnly = ALL_STEPS.filter((s) =>
      s.evidence.every((e) => e.certainty === 'first_hand' || e.certainty === 'unchecked'),
    );
    // ⭐ Was four. fz.completion_in_person GRADUATED on 27.8 when Chaya supplied
    // the gov.il text: the timing and the online-only channel are now quoted,
    // and her contrary experience sits beside them rather than alone.
    // ⭐ Back to four on 30.8, and the newcomer is the clearest example the
    // test has: NO official source anywhere documents that renewing a passport
    // breaks the 89, or that the consequence is a test recorded as a FAILURE
    // rather than a no-show. Chaya lived it. Demanding a government citation
    // would delete the single most expensive warning in the product.
    expect(fieldOnly.map((s) => s.id).sort()).toEqual([
      'fix.update_89',
      'fz.permit_fee',
      'fz.permit_in_person',
      'fz.plastic_fee',
    ]);
    // And each of them still carries a real report, not just a shrug.
    for (const step of fieldOnly) {
      expect(step.evidence.some((e) => e.certainty === 'first_hand'), step.id).toBe(true);
    }
  });

  it('⭐ but a step backed ONLY by "never checked" cannot exist', () => {
    // The gap Chaya found: evidence.min(1) demanded something be attached, not
    // that it be a reason. A step telling someone to act needs at least one.
    for (const step of ALL_STEPS) {
      const hasAReason = step.evidence.some((e) => e.certainty !== 'unchecked');
      expect(hasAReason, `${step.id} is backed only by "never checked"`).toBe(true);
    }
  });

  it('and the loader rejects one, rather than trusting us to notice', () => {
    const noReason = {
      id: 'fz.nothing', track: 'from_zero',
      title: { he: 'א', en: 'a' }, action: { he: 'ב', en: 'b' },
      applies_when: { always: true }, sequence_position: 99, channel: 'online',
      evidence: [
        { claim: 'we never looked into any of this', certainty: 'unchecked',
          last_verified_at: '2026-08-25', variation_factors: [] },
      ],
    };
    expect(CheckedStep.safeParse(noReason).success).toBe(false);
    // The same step with one field report behind it is fine.
    const withReport = {
      ...noReason,
      evidence: [
        ...noReason.evidence,
        { claim: 'someone did this and it worked', certainty: 'first_hand',
          last_verified_at: '2026-08-25', report_count: 1, variation_factors: [] },
      ],
    };
    expect(CheckedStep.safeParse(withReport).success).toBe(true);
  });

  it('nothing marked "never checked" smuggles in a citation', () => {
    for (const step of ALL_STEPS) {
      for (const part of step.evidence) {
        if (part.certainty === 'unchecked') {
          expect(part.quote, `${step.id}: ⬜ with a quote`).toBeFalsy();
          expect(part.citation, `${step.id}: ⬜ with a citation`).toBeFalsy();
        }
      }
    }
  });
});

describe('structure — nothing dangles', () => {
  const ids = new Set(ALL_STEPS.map((s) => s.id));

  it('step ids are unique', () => {
    expect(ids.size).toBe(ALL_STEPS.length);
  });

  it('every must_come_after points at a step that exists', () => {
    for (const step of ALL_STEPS) {
      for (const prior of step.must_come_after) {
        expect(ids.has(prior), `${step.id} must come after "${prior}", which does not exist`).toBe(true);
      }
    }
  });

  it('every act_when.before points at a step that exists', () => {
    for (const step of ALL_STEPS) {
      if (typeof step.act_when === 'object' && 'before' in step.act_when) {
        expect(
          ids.has(step.act_when.before),
          `${step.id} must happen before "${step.act_when.before}", which does not exist`,
        ).toBe(true);
      }
    }
  });

  it('no step must come after itself', () => {
    for (const step of ALL_STEPS) {
      expect(step.must_come_after).not.toContain(step.id);
    }
  });

  it('ordering constraints have no cycles', () => {
    const byId = new Map(ALL_STEPS.map((s) => [s.id, s]));
    const state = new Map<string, 'visiting' | 'done'>();

    const walk = (id: string, trail: string[]): void => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'visiting') {
        throw new Error(`Ordering cycle: ${[...trail, id].join(' → ')}`);
      }
      state.set(id, 'visiting');
      for (const prior of byId.get(id)?.must_come_after ?? []) walk(prior, [...trail, id]);
      state.set(id, 'done');
    };

    expect(() => ALL_STEPS.forEach((s) => walk(s.id, []))).not.toThrow();
  });

  it('every applies_when is a valid condition', () => {
    for (const step of ALL_STEPS) {
      expect(Condition.safeParse(step.applies_when).success, `${step.id}`).toBe(true);
    }
  });
});

describe('the research rules hold across the whole file', () => {
  it('a step resting only on field reports offers a fallback, never a bare hedge', () => {
    // Chaya's rule: "אל תרככי את העצה, בני לתוכה נפילה לאחור."
    // Applies where the advice tells someone to DO something unverified — the
    // walk-in is the case that produced the rule.
    const walkIn = ALL_STEPS.find((s) => s.id === 'fz.doc_89')!;
    expect(walkIn.requires_appointment).toBe(false);
    expect(walkIn.fallback).toBeDefined();
    expect(walkIn.fallback!.he).toContain('קבע תור');
  });

  it('the 89 document comes before the online form and the eye test', () => {
    const form = ALL_STEPS.find((s) => s.id === 'fz.online_form')!;
    const eye = ALL_STEPS.find((s) => s.id === 'fz.photo_and_eye')!;
    expect(form.must_come_after).toContain('fz.doc_89');
    expect(eye.must_come_after).toContain('fz.doc_89');
  });

  it('the permit appointment is booked before the test, though it is listed after it', () => {
    const booking = ALL_STEPS.find((s) => s.id === 'fz.book_permit_appointment')!;
    const test = ALL_STEPS.find((s) => s.id === 'fz.test')!;
    expect(booking.sequence_position).toBeLessThan(test.sequence_position + 1);
    expect(booking.act_when).toEqual({ before: 'fz.test' });
  });

  it('the same step splits by channel, never by entitlement', () => {
    // גיליון F0: "ת״ז אינה משנה זכאות, היא משנה ערוץ."
    const online = ALL_STEPS.find((s) => s.id === 'fz.permit_online')!;
    const inPerson = ALL_STEPS.find((s) => s.id === 'fz.permit_in_person')!;
    expect(online.sequence_position).toBe(inPerson.sequence_position);
    expect(online.channel).toBe('online');
    expect(inPerson.channel).toBe('licensing_office');
  });

  it('no step tells anyone without a teudat zehut that they are not entitled', () => {
    // The only block in this system is 2(א)(5), and it is a Blocker, not a Step.
    for (const step of ALL_STEPS) {
      expect(step.action.he).not.toContain('אינך זכאי');
      expect(step.action.en.toLowerCase()).not.toContain('not eligible');
    }
  });

  it('the conversion route starts with the רקורד, though it is needed last', () => {
    // גיליון 13 principle 3. Longest lead time, depends on a foreign authority.
    const record = stepById('cv.record');
    expect(record.sequence_position).toBe(1);
    expect(record.act_when).toBe('start_now');
    expect(record.lead_time_days).toBeGreaterThan(0);
  });

  it('the conversion route admits it does not know how delivery works', () => {
    // The נוהל was read cover to cover and says nothing about this stage.
    const receive = stepById('cv.receive');
    expect(receive.evidence.some((e) => e.certainty === 'unchecked')).toBe(true);
  });

  it('no fee is presented without a mark, and no total is precomputed', () => {
    const totals = ALL_STEPS.filter((s) => s.cost?.amount_ils).length;
    expect(totals).toBeGreaterThan(0);
    // There is deliberately no SUM anywhere. Principle 22: cost belongs to the
    // step, never to a discouraging headline figure.
    expect(Object.keys(ALL_STEPS[0]!)).not.toContain('total_cost');
  });
});

describe('the exemption — the highest-consequence rule in the conversion route', () => {
  const eyeTest = () => stepById('cv.eye_test').applies_when;
  const controlTest = () => stepById('cv.control_test').applies_when;

  it('five years on a permanent licence + a רקורד + grade B exempts him from BOTH tests', () => {
    // נוהל ס' 2: "פטור מבדיקת ראיה וממבחן שליטה" — the exemption is double.
    expect(evaluateCondition(eyeTest(), veteranConverter)).toBe(false);
    expect(evaluateCondition(controlTest(), veteranConverter)).toBe(false);
  });

  it('⭐ C1 still needs מבחן שליטה after twenty years — the 180 vs 181 gap', () => {
    // The obligation runs to תקנה 181. The exemption stops at 180.
    // This is תיקון 6, a gap Chaya caught herself on 20.8.
    const wantsC1: Facts = { ...veteranConverter, requested_class: 'C1', foreign_license_years: 20 };
    expect(evaluateCondition(controlTest(), wantsC1)).toBe(true);
    expect(evaluateCondition(eyeTest(), wantsC1)).toBe(true);
  });

  it('no רקורד means no exemption, however long he has held the licence', () => {
    // Seniority he cannot prove is seniority he does not have.
    const noRecord: Facts = { ...veteranConverter, has_record_document: 'no' };
    expect(evaluateCondition(controlTest(), noRecord)).toBe(true);
  });

  it('a country that does not issue a רקורד is treated as "no exemption", not as an error', () => {
    const cannotGetOne: Facts = {
      ...veteranConverter,
      has_record_document: 'origin_country_does_not_issue',
    };
    expect(evaluateCondition(controlTest(), cannotGetOne)).toBe(true);
  });

  it('under five years needs both tests', () => {
    const newDriver: Facts = { ...veteranConverter, foreign_license_years: 2 };
    expect(evaluateCondition(eyeTest(), newDriver)).toBe(true);
    expect(evaluateCondition(controlTest(), newDriver)).toBe(true);
  });

  it('⭐ when he never said how long he has held it, the tests stay on his roadmap as UNKNOWN', () => {
    // Not false. He is not told "you are exempt" on the strength of a blank.
    const vague: Facts = { ...veteranConverter, foreign_license_years: 'unknown' };
    expect(evaluateCondition(eyeTest(), vague)).toBe('unknown');
    expect(evaluateCondition(controlTest(), vague)).toBe('unknown');
  });
});

describe('the entries-and-exits form is asked of exactly one category', () => {
  // כל-זכות demands it from everyone and contradicts the נוהל. The נוהל wins.
  const form = () => stepById('cv.entry_exit_form').applies_when;

  it('applies to תושב ישראל ששב', () => {
    expect(evaluateCondition(form(), { ...veteranConverter, nohal_category: 'toshav_israel' })).toBe(true);
  });

  it('is never asked of a תושב מדינת חוץ, who is not even entitled to request it', () => {
    expect(evaluateCondition(form(), veteranConverter)).toBe(false);
  });

  it('is never asked of an עולה חדש', () => {
    expect(evaluateCondition(form(), { ...veteranConverter, nohal_category: 'oleh_chadash' })).toBe(false);
  });
});
