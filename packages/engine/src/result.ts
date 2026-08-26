import type { Trilean, ConditionField, NohalCategory, Track, Facts } from './condition';
import type { Step, Blocker, Clock, ContinuousCondition, Text } from './domain';
import type { ProfileWarning } from './profile';
import type { IsoDate } from './dates';

/**
 * ============================================================================
 * RESULT — what the engine hands back
 * ============================================================================
 *
 * This is also the API contract. apps/web renders exactly this and computes
 * nothing of its own, so a rule can never be applied differently on screen than
 * it was in the engine.
 */

/**
 * Where a step stands for this person.
 *
 * ⚠️ 'uncertain' is a first-class state, not an error. A step we cannot place
 * stays on the roadmap saying so, because גיליון 13 principle 8 is explicit that
 * the real answer to "does this apply to me?" is usually yes.
 */
export type StepState =
  | 'done' // he ticked it
  | 'do_now' // available, and nothing is holding it up
  | 'waiting_on' // a prerequisite step is not done yet
  | 'later' // further down the road
  | 'uncertain'; // we cannot tell whether it applies to him

export type RoadmapStep = {
  step: Step;

  /** true or 'unknown'. Steps that evaluate false are not in the roadmap at all. */
  applies: Trilean;

  state: StepState;

  /** Step ids he still has to do first. */
  waiting_on: string[];

  /**
   * ⭐ Start this now even though it sits further down the list. The רקורד and
   * the permit appointment are both here — the whole reason `act_when` exists
   * separately from `sequence_position`.
   */
  start_now: boolean;

  /** For act_when: { before }. Must be finished before this other step. */
  must_precede?: string;

  /**
   * If `applies` is 'unknown', the questions that would settle it. Turns a vague
   * maybe into one thing he can actually answer.
   */
  missing_answers: ConditionField[];

  /** Re-checked before this step every time. A completed step can be voided silently. */
  checks_first: ContinuousCondition[];
};

export type ClockStatus = 'running' | 'expired' | 'unknown' | 'not_started';

export type ClockState = {
  clock: Clock;
  status: ClockStatus;
  /** null when we do not know the anchor date — we do not invent one. */
  starts: IsoDate | null;
  deadline: IsoDate | null;
  days_left: number | null;
  /** Inside the clock's own warning window. */
  warning: boolean;
  /** Which answer is missing, when status is 'unknown'. */
  missing_answer?: ConditionField;
};

export type Diagnosis = {
  nohal_category: NohalCategory | 'unknown';
  track: Track | 'unknown';
  has_teudat_zehut: Trilean;
  /** תקנות range he may be issued. null when his status is not covered by the נוהל. */
  grade_ceiling: { from: number; to: number } | null;
  /** Category-specific extras, e.g. the six consecutive months abroad. */
  extra_requirements: Text[];
  /** Anything specific to his status, e.g. the ב/2 short-visa trap. */
  caveat?: Text;
  /** Everything he left unanswered that the roadmap actually wanted. */
  unanswered: ConditionField[];
};

/**
 * ⚠️ A blocked result still carries a diagnosis and an explanation. F6 rule 3:
 * "אסור לדלג על השאלות הבאות בלי הסבר. משתמש שנחסם חייב לדעת למה ומכוח מה."
 */
export type BlockedResult = {
  blocker: Blocker;
  /** Days until the proceeding is expected to resolve. Negative once that date has passed. */
  days_to_expected_resolution: number | null;
};

export type Result = {
  /** The facts the engine reasoned over. Exposed so any answer can be traced back. */
  facts: Facts;
  diagnosis: Diagnosis;

  /** Non-null means the roadmap is empty and this is the whole answer. */
  blocked: BlockedResult | null;

  roadmap: RoadmapStep[];
  clocks: ClockState[];

  /**
   * Conditions that must hold throughout, shown as a standing warning at the top
   * of the roadmap. At POC they cannot fire as alerts, because nothing is saved.
   */
  standing_conditions: ContinuousCondition[];

  /** Contradictions in his answers. Warnings only — they never stop the roadmap. */
  warnings: ProfileWarning[];
};
