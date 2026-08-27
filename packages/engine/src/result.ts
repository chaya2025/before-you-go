import type { Trilean, ConditionField, NohalCategory, Track, Facts } from './condition';
import type { Step, Blocker, Clock, ContinuousCondition, Text, RequiredDocument } from './domain';
import type { SourcePart } from './certainty';
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

  /**
   * ⚠️ RESOLVED and FILTERED, not the raw id list on the step.
   *
   * Every document declares its own `applies_when`. A step shared between the
   * two channels lists everything either of them might need, so the engine has
   * to ask each document whether it applies to THIS person. Without that, a
   * citizen was being told to bring his 89 document — one he was correctly
   * never told to obtain. Found by the founder, 27.8.
   */
  documents: RequiredDocument[];

  /** Checklist lines that actually apply to him. Same filtering as documents. */
  checklist: Text[];
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

/**
 * ⭐ Something that has to be dealt with BEFORE the roadmap means anything.
 *
 * From the POC document: "אשרה שפג תוקפה אינה הערת שוליים במפת הדרכים — היא
 * הופכת לשלב הראשון בה."
 *
 * ⚠️ Found by audit on 27.8: `visa_valid_now: false` changed absolutely nothing
 * in the output. The question was being asked and the answer thrown away, which
 * is worse than not asking — the user reasonably assumes an answer that changed
 * nothing did not matter.
 */
export type UrgentIssue = {
  id: string;
  title: Text;
  /** What it actually stops him doing. */
  consequence: Text;
  /** What to do about it. Never just the bad news. */
  action: Text;
  evidence: SourcePart[];
};

/** Whether the grade he asked for is available to his category at all. */
export type CeilingStatus = 'within' | 'above' | 'unknown';

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

  /** The grade he asked to convert to, echoed back so the summary is checkable. */
  requested_class: string | 'unknown';

  /**
   * ⭐ Is that grade even available to him?
   *
   * נוהל ס' 1(ג): a תושב מדינת חוץ may not be issued anything outside 176-181.
   * That is an ENTITLEMENT limit — there is no conversion route to a bus or a
   * heavy truck under any conditions, however long he has driven one.
   */
  requested_class_status: CeilingStatus;
  ceiling_explanation?: Text;

  /**
   * Whether the two tests are expected. Derived from the roadmap rather than
   * recomputed, so the summary can never disagree with the steps below it.
   */
  exemption: 'exempt' | 'tests_required' | 'unknown';
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

  /**
   * ⚠️ Deal with these first. Rendered above the roadmap, because a roadmap
   * built on a lapsed visa describes a process he cannot currently start.
   */
  urgent: UrgentIssue[];

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
