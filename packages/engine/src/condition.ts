import { z } from 'zod';
import { VisaType, LicenseClass } from './profile';

/**
 * ============================================================================
 * CONDITION — how a step decides whether it applies to this person
 * ============================================================================
 *
 * גיליון 13 models this as an entity: `condition · step_id · field · operator · value`.
 * Conditions are DATA, not code. A rule about who needs a מספר 89 lives in the
 * data file next to its quote and its certainty mark, not in a TypeScript `if`.
 * That is what keeps every requirement traceable to a source (hard rule 4).
 *
 * ⚠️ The whole file turns on one thing: answers can be UNKNOWN, so the answer to
 * "does this step apply to you?" can also be unknown. It is not allowed to
 * collapse into "no".
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Three-valued logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Yes / no / we cannot tell from what he told us.
 *
 * Ordinary boolean logic has no room for the third one, and that is exactly how
 * a person gets told "you don't need this step" when the truth was "we don't
 * know whether you need this step". גיליון 13 principle 8:
 *
 *   "אל תציגי 'לא ידוע' כ'לא'. נסחי: 'לא מצאנו מידע — כדאי לברר ב-*4515'.
 *    התשובה האמיתית לרוב היא כן."
 *
 * Note the last sentence. When we cannot tell, the real answer is usually YES.
 * So an unknown step stays on the roadmap, marked as uncertain, instead of
 * silently disappearing from it.
 */
export type Trilean = true | false | 'unknown';

/** AND. One false is enough to decide. Otherwise any unknown makes the whole thing unknown. */
export function and(values: readonly Trilean[]): Trilean {
  if (values.some((v) => v === false)) return false;
  if (values.some((v) => v === 'unknown')) return 'unknown';
  return true;
}

/** OR. One true is enough to decide. Otherwise any unknown makes the whole thing unknown. */
export function or(values: readonly Trilean[]): Trilean {
  if (values.some((v) => v === true)) return true;
  if (values.some((v) => v === 'unknown')) return 'unknown';
  return false;
}

/** NOT. Flips a decision. Leaves ignorance alone — the opposite of "we don't know" is "we don't know". */
export function not(value: Trilean): Trilean {
  return value === 'unknown' ? 'unknown' : !value;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. What a condition may look at
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The addressable facts. A closed list on purpose: a typo in the data file
 * becomes a load-time failure instead of a rule that silently never matches.
 *
 * Some of these are answered directly by the user, some are derived (the
 * category he falls into, how long since his anchor event, his age). Derivation
 * happens in the evaluator; conditions only ever read the finished facts.
 */
export const ConditionField = z.enum([
  // answered directly
  'visa_type',
  'has_teudat_zehut',
  'visa_valid_now',
  'foreign_license_kind',
  'foreign_license_valid',
  'foreign_license_years',
  'held_class',
  'requested_class',
  'has_record_document',
  'lived_abroad_6_months_continuous',
  'origin_country',

  // derived by the evaluator
  'nohal_category', // עולה חדש · תושב ישראל · תושב מדינת חוץ · לא מוגדר בנוהל
  'track', // conversion · from_zero
  'months_since_anchor', // from whichever of עלייה / שיבה / כניסה applies
  'age_years', // at the moment the rule is evaluated

  // ── the documents (ש7), all derived by comparison ────────────────────────
  // ⚠️ A fact that is not listed here is invisible to every rule. That is how
  // visa_expires sat in the Profile for days changing nothing.
  'months_until_visa_expiry',
  'passport_valid_now',
  'months_until_passport_expiry',
  'passport_89_number_match',
  'passport_89_name_match',
  'passport_license_name_match',
  'months_until_license_expiry',
  'foreign_license_language',
]);
export type ConditionField = z.infer<typeof ConditionField>;

export const NohalCategory = z.enum([
  'oleh_chadash', // עולה חדש — ס' 1(א)
  'toshav_israel', // תושב ישראל ששב — ס' 1(ב)
  'toshav_medinat_chutz', // תושב מדינת חוץ — ס' 1(ג), capped at 176-181
  'not_defined_in_nohal', // דיפלומט · 2(א)(5)
]);
export type NohalCategory = z.infer<typeof NohalCategory>;

/**
 * ⭐ WHICH DATE EACH CATEGORY COUNTS FROM. One definition, exported, because it
 * was being made twice.
 *
 * ⚠️ Found 30.8 during a critical pass. Intake.tsx decided which date question
 * to ask by hardcoding visa codes — a1 means aliyah, citizen or permanent
 * resident means return, everything else means entry. The engine decided the
 * same thing from nohal_category, in deriveFacts.
 *
 * They agreed on the day I checked. But גיליון 14 had ALREADY reclassified
 * תושב קבע once, from תושב מדינת חוץ to תושב ישראל, and the website would not
 * have followed: it would have gone on asking a returning resident when he
 * ENTERED Israel, and the engine would have looked for a date he was never
 * asked for. The clocks would simply have read 'unknown' and nobody would have
 * known why.
 *
 * That is domain knowledge living in the website, which this architecture says
 * it must never hold. Now both read this.
 */
export const ANCHOR_FIELD_BY_CATEGORY = {
  oleh_chadash: 'made_aliyah',
  toshav_israel: 'returned_to_israel',
  toshav_medinat_chutz: 'entered_israel',
  not_defined_in_nohal: 'entered_israel',
} as const satisfies Record<NohalCategory, 'made_aliyah' | 'returned_to_israel' | 'entered_israel'>;

export type AnchorField = (typeof ANCHOR_FIELD_BY_CATEGORY)[NohalCategory];

/** Falls back to entry, which is the right default for an unplaced status. */
export function anchorFieldFor(category: NohalCategory | 'unknown'): AnchorField {
  return category === 'unknown' ? 'entered_israel' : ANCHOR_FIELD_BY_CATEGORY[category];
}

export const Track = z.enum(['conversion', 'from_zero']);
export type Track = z.infer<typeof Track>;

/**
 * The finished facts a condition is tested against. Every value may be
 * 'unknown', including the derived ones — if we do not know when he entered,
 * we do not know how many months have passed, and pretending otherwise is how
 * someone gets told his window closed.
 */
export type Facts = {
  visa_type: VisaType;
  has_teudat_zehut: Trilean;
  visa_valid_now: Trilean;
  foreign_license_kind: 'national' | 'idp_only' | 'none' | 'unknown';
  foreign_license_valid: Trilean;
  foreign_license_years: number | 'unknown';
  held_class: LicenseClass | 'unknown';
  requested_class: LicenseClass | 'unknown';
  has_record_document: 'yes' | 'no' | 'in_progress' | 'origin_country_does_not_issue' | 'unknown';
  lived_abroad_6_months_continuous: Trilean;
  origin_country: string | 'unknown';
  nohal_category: NohalCategory | 'unknown';
  track: Track | 'unknown';
  months_since_anchor: number | 'unknown';
  age_years: number | 'unknown';

  /**
   * Whole months from today until the visa's expiry month. Negative once that
   * month has passed. 'unknown' when he did not give a date.
   *
   * ⚠️ Derived, never asked. The user answers a month; this is the arithmetic.
   */
  months_until_visa_expiry: number | 'unknown';

  // ── the documents he is holding (ש7) ─────────────────────────────────────
  //
  // ⭐ All derived by comparing what he transcribed. He is never asked whether
  // his documents agree; he is asked what they say, and the engine notices.

  passport_valid_now: Trilean;
  months_until_passport_expiry: number | 'unknown';

  /**
   * ⭐ Does the passport number printed on the 89 match the passport he holds?
   *
   * The single most expensive mismatch in the research. Per
   * cc.passport_number_match a failure here does not turn him away: the test is
   * RECORDED AS A FAILURE, fee paid and wait wasted, and appealing blocks him
   * from booking another until it concludes.
   */
  passport_89_number_match: Trilean;

  /** Same idea, on the name. 'unknown' when the 89 carries no name field. */
  passport_89_name_match: Trilean;

  /** Passport against the foreign licence. Transliteration splits these. */
  passport_license_name_match: Trilean;

  months_until_license_expiry: number | 'unknown';

  /** Drives doc.translation, which existed with no way to know it applied. */
  foreign_license_language: 'he' | 'en' | 'other' | 'unknown';
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. The shape of a condition
// ─────────────────────────────────────────────────────────────────────────────

export const Operator = z.enum([
  'eq',
  'ne',
  'in',
  'not_in',
  'lt',
  'lte',
  'gt',
  'gte',
  /** Decidable even when the fact is unknown — that IS the question being asked. */
  'is_known',
  'is_unknown',
]);
export type Operator = z.infer<typeof Operator>;

const ConditionValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

export type Condition =
  | { always: true }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | {
      field: ConditionField;
      op: Operator;
      value?: string | number | boolean | (string | number)[];
    };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ always: z.literal(true) }),
    z.object({ all: z.array(Condition).min(1) }),
    z.object({ any: z.array(Condition).min(1) }),
    z.object({ not: Condition }),
    z.object({
      field: ConditionField,
      op: Operator,
      value: ConditionValue.optional(),
    }),
  ]),
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Evaluation
// ─────────────────────────────────────────────────────────────────────────────

const isUnknown = (v: unknown): boolean => v === 'unknown';

/**
 * Does this condition hold for this person?
 *
 * Returns true, false, or 'unknown'. A caller that treats 'unknown' as false is
 * breaking principle 8, so the return type makes that impossible to do by
 * accident — TypeScript will not let `'unknown'` pass as a boolean.
 */
export function evaluateCondition(condition: Condition, facts: Facts): Trilean {
  if ('always' in condition) return true;
  if ('all' in condition) return and(condition.all.map((c) => evaluateCondition(c, facts)));
  if ('any' in condition) return or(condition.any.map((c) => evaluateCondition(c, facts)));
  if ('not' in condition) return not(evaluateCondition(condition.not, facts));

  const actual = facts[condition.field];
  const expected = condition.value;

  // These two ask ABOUT the gap, so a gap is not an obstacle to answering them.
  if (condition.op === 'is_known') return !isUnknown(actual);
  if (condition.op === 'is_unknown') return isUnknown(actual);

  // ⚠️ Everything else: no answer means no verdict. Never a quiet "no".
  if (isUnknown(actual)) return 'unknown';

  switch (condition.op) {
    case 'eq':
      return actual === expected;
    case 'ne':
      return actual !== expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual as string | number);
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual as string | number);
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      if (typeof actual !== 'number' || typeof expected !== 'number') return 'unknown';
      if (condition.op === 'lt') return actual < expected;
      if (condition.op === 'lte') return actual <= expected;
      if (condition.op === 'gt') return actual > expected;
      return actual >= expected;
    }
  }
}

/**
 * Which facts a condition depends on.
 *
 * Used to turn "we cannot tell whether this step applies to you" into something
 * actionable: the user is told exactly which question would settle it, instead
 * of being left with a vague maybe.
 */
export function fieldsUsed(condition: Condition): ConditionField[] {
  if ('always' in condition) return [];
  if ('all' in condition) return condition.all.flatMap(fieldsUsed);
  if ('any' in condition) return condition.any.flatMap(fieldsUsed);
  if ('not' in condition) return fieldsUsed(condition.not);
  return [condition.field];
}

/** The facts that are missing and are actually blocking a verdict. */
export function missingFacts(condition: Condition, facts: Facts): ConditionField[] {
  return [...new Set(fieldsUsed(condition))].filter((f) => isUnknown(facts[f]));
}
