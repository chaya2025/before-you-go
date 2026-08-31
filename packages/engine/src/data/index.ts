import { FROM_ZERO_STEPS } from './steps.from-zero';
import { CONVERSION_STEPS } from './steps.conversion';
import { FIX_STEPS } from './steps.fixes';
import { VISA_PROFILES, CATEGORY_RULES } from './eligibility';
import { BLOCKERS } from './blockers';
import { CLOCKS } from './clocks';
import { CONTINUOUS_CONDITIONS } from './continuous';
import { DOCUMENTS } from './documents';
import { PROCESSES, Process, type Process as ProcessType } from './processes';
import {
  Step,
  CheckedStep,
  VisaProfile,
  CategoryRule,
  Blocker,
  Clock,
  ContinuousCondition,
  RequiredDocument,
  type Step as StepType,
  type Clock as ClockType,
  type ContinuousCondition as ContinuousConditionType,
  type RequiredDocument as RequiredDocumentType,
  type VisaProfile as VisaProfileType,
  type CategoryRule as CategoryRuleType,
  type Blocker as BlockerType,
} from '../domain';

/**
 * Every step the engine knows about.
 *
 * ⚠️ Parsed HERE, at import time. A step that breaks a schema rule — a claim
 * marked verified with no quote, a bad condition, an invented channel — throws
 * the moment this module loads. The system cannot start holding broken data.
 *
 * Both routes. They are kept as separate files because they come from separate
 * sources with opposite evidence profiles — the נוהל for conversion, the gov.il
 * service page plus one documented case for from-zero.
 */
// ⭐ FIX_STEPS first, and their sequence_position is negative, because a
// document that is wrong comes before step one of either route — it is what
// makes step one possible. Chaya, 30.8.
export const ALL_STEPS: StepType[] = [...FIX_STEPS, ...FROM_ZERO_STEPS, ...CONVERSION_STEPS].map((step) => {
  const parsed = CheckedStep.safeParse(step);
  if (!parsed.success) {
    throw new Error(
      `Step "${step.id}" is not valid:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
    );
  }
  return parsed.data;
});

/** Parsed at import time, same as the steps: a malformed rule never loads. */
export const ALL_VISA_PROFILES: VisaProfileType[] = VISA_PROFILES.map((v) => {
  const parsed = VisaProfile.safeParse(v);
  if (!parsed.success) {
    throw new Error(`Visa "${v.visa_type}" is not valid:\n${JSON.stringify(parsed.error.issues, null, 2)}`);
  }
  return parsed.data;
});

export const ALL_CATEGORY_RULES: CategoryRuleType[] = CATEGORY_RULES.map((c) => {
  const parsed = CategoryRule.safeParse(c);
  if (!parsed.success) {
    throw new Error(`Category "${c.category}" is not valid:\n${JSON.stringify(parsed.error.issues, null, 2)}`);
  }
  return parsed.data;
});

export const ALL_BLOCKERS: BlockerType[] = BLOCKERS.map((b) => {
  const parsed = Blocker.safeParse(b);
  if (!parsed.success) {
    throw new Error(`Blocker "${b.id}" is not valid:\n${JSON.stringify(parsed.error.issues, null, 2)}`);
  }
  return parsed.data;
});

export const ALL_CLOCKS: ClockType[] = CLOCKS.map((c) => {
  const parsed = Clock.safeParse(c);
  if (!parsed.success) {
    throw new Error(`Clock "${c.id}" is not valid:
${JSON.stringify(parsed.error.issues, null, 2)}`);
  }
  return parsed.data;
});

export const ALL_CONTINUOUS_CONDITIONS: ContinuousConditionType[] = CONTINUOUS_CONDITIONS.map((c) => {
  const parsed = ContinuousCondition.safeParse(c);
  if (!parsed.success) {
    throw new Error(`Continuous condition "${c.id}" is not valid:
${JSON.stringify(parsed.error.issues, null, 2)}`);
  }
  return parsed.data;
});

export const ALL_DOCUMENTS: RequiredDocumentType[] = DOCUMENTS.map((d) => {
  const parsed = RequiredDocument.safeParse(d);
  if (!parsed.success) {
    throw new Error(`Document "${d.id}" is not valid:
${JSON.stringify(parsed.error.issues, null, 2)}`);
  }
  return parsed.data;
});

/**
 * ⚠️ Parsed at import time like everything else. A malformed process fails the
 * build rather than reaching a landing page.
 */
export const ALL_PROCESSES: ProcessType[] = PROCESSES.map((p) => {
  const parsed = Process.safeParse(p);
  if (!parsed.success) {
    throw new Error(`Process "${p.id}" is not valid:
${JSON.stringify(parsed.error.issues, null, 2)}`);
  }
  return parsed.data;
});

/** Look-ups the evaluator uses constantly. */
export const visaProfileFor = (visaType: string) =>
  ALL_VISA_PROFILES.find((v) => v.visa_type === visaType);

export const categoryRuleFor = (category: string) =>
  ALL_CATEGORY_RULES.find((c) => c.category === category);

export const documentById = (id: string) => ALL_DOCUMENTS.find((d) => d.id === id);

export {
  FROM_ZERO_STEPS,
  CONVERSION_STEPS,
  FIX_STEPS,
  VISA_PROFILES,
  CATEGORY_RULES,
  BLOCKERS,
  CLOCKS,
  CONTINUOUS_CONDITIONS,
  DOCUMENTS,
  PROCESSES,
};
export * from './sources';
export * from './processes';
