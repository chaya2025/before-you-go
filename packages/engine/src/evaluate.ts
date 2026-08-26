import type { Profile } from './profile';
import { checkProfile } from './profile';
import type { Facts, Trilean, ConditionField, NohalCategory, Track } from './condition';
import { evaluateCondition, missingFacts } from './condition';
import type { Step, Clock } from './domain';
import {
  ALL_STEPS,
  ALL_BLOCKERS,
  ALL_CLOCKS,
  ALL_CONTINUOUS_CONDITIONS,
  visaProfileFor,
  categoryRuleFor,
} from './data';
import type { Result, RoadmapStep, ClockState, Diagnosis, StepState } from './result';
import { monthsSince, ageInYears, startOfMonth, addDays, daysBetween, type IsoDate } from './dates';

/**
 * ============================================================================
 * THE EVALUATOR
 * ============================================================================
 *
 * One function. A person goes in, his roadmap comes out.
 *
 * ⚠️ Pure: no network, no files, no clock of its own — `today` is passed in, so
 * the same inputs always produce the same output and every test is repeatable.
 *
 * ⭐ It DECIDES. The model never does. This is hard rule 3 of the project made
 * literal: the LLM will later phrase what is computed here, and will not be
 * allowed to add a step, remove one, or change an eligibility answer.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Derive the facts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turns what he answered into what the rules ask about.
 *
 * ⚠️ Every derived value can come out 'unknown', and that is the point. If we do
 * not know when he entered, we do not know how many months have passed, and
 * inventing a number here is how somebody gets told his window closed.
 */
export function deriveFacts(profile: Profile, today: IsoDate): Facts {
  const visa = visaProfileFor(profile.visa_type);

  const nohal_category: NohalCategory | 'unknown' = visa ? visa.nohal_category : 'unknown';

  // Conversion needs a NATIONAL licence. An IDP is not one — that trap is a
  // routing decision here, never a block: he is fully entitled to go from zero.
  const track: Track | 'unknown' =
    profile.foreign_license.kind === 'national'
      ? 'conversion'
      : profile.foreign_license.kind === 'unknown'
        ? 'unknown'
        : 'from_zero';

  // ⚠️ `anchor_differs_by_status`. Three categories, three different events,
  // and reading the wrong one silently computes the wrong deadline.
  const anchorAnswer =
    nohal_category === 'oleh_chadash'
      ? profile.made_aliyah
      : nohal_category === 'toshav_israel'
        ? profile.returned_to_israel
        : profile.entered_israel;

  const months_since_anchor =
    anchorAnswer === 'unknown' ? 'unknown' : (monthsSince(anchorAnswer, today) ?? 'unknown');

  const age_years =
    profile.born === 'unknown' ? 'unknown' : (ageInYears(profile.born, today) ?? 'unknown');

  return {
    visa_type: profile.visa_type,
    // ⚠️ The user's answer, never the visa's default. The default is only a
    // suggestion on the confirmation screen; א/5 proves why they must stay apart.
    has_teudat_zehut: profile.has_teudat_zehut,
    visa_valid_now: profile.visa_valid_now,
    foreign_license_kind: profile.foreign_license.kind,
    foreign_license_valid: profile.foreign_license.valid_now,
    foreign_license_years: profile.foreign_license.years_held_permanent,
    held_class: profile.foreign_license.held_class,
    requested_class: profile.requested_class,
    has_record_document: profile.has_record_document,
    lived_abroad_6_months_continuous: profile.lived_abroad_6_months_continuous,
    origin_country: profile.foreign_license.country ?? 'unknown',
    nohal_category,
    track,
    months_since_anchor,
    age_years,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Clocks
// ─────────────────────────────────────────────────────────────────────────────

/** Which answer a clock counts from, given his category. */
function anchorDateFor(clock: Clock, profile: Profile, facts: Facts): string | 'unknown' {
  switch (clock.anchor) {
    case 'entry_to_israel':
      // ⚠️ Always entry, even for an עולה whose conversion window runs from
      // עלייה. Same person, two clocks, two starting dates.
      return profile.entered_israel;
    case 'category_anchor':
      return facts.nohal_category === 'oleh_chadash'
        ? profile.made_aliyah
        : facts.nohal_category === 'toshav_israel'
          ? profile.returned_to_israel
          : profile.entered_israel;
    default:
      // license_issued, test_passed, theory_passed, duplicate_fee_paid,
      // medical_declaration — all process events. The POC saves nothing between
      // visits, so it has no dates for them. They are shown as rules with no
      // countdown rather than hidden.
      return 'unknown';
  }
}

/**
 * ⚠️ Anchors come in two kinds, and confusing them produces a screen full of
 * meaningless "unknown".
 *
 *   · A DATE HE COULD TELL US (entry, aliyah, return). Missing means we are
 *     missing an answer → 'unknown', and we name the question.
 *   · A PROCESS EVENT (passing the test, the licence issuing, paying the
 *     duplicate fee). Missing means it has not happened yet → 'not_started'.
 *
 * Found by reading real output rather than by a failing test: Chaya's roadmap
 * showed four clocks as "unknown" when three of them simply had not begun.
 */
const ANSWERABLE_ANCHORS = ['category_anchor', 'entry_to_israel'] as const;

function computeClock(clock: Clock, profile: Profile, facts: Facts, today: IsoDate): ClockState {
  const applies = evaluateCondition(clock.applies_when, facts);
  const anchor = anchorDateFor(clock, profile, facts);
  const answerable = (ANSWERABLE_ANCHORS as readonly string[]).includes(clock.anchor);

  if (anchor === 'unknown') {
    return {
      clock,
      status: applies === false ? 'not_started' : answerable ? 'unknown' : 'not_started',
      starts: null,
      deadline: null,
      days_left: null,
      warning: false,
      ...(answerable ? { missing_answer: 'months_since_anchor' as ConditionField } : {}),
    };
  }

  const starts = startOfMonth(anchor);
  const deadline = starts ? addDays(starts, clock.duration_days) : null;
  const days_left = deadline ? daysBetween(today, deadline) : null;

  return {
    clock,
    status: days_left === null ? 'unknown' : days_left < 0 ? 'expired' : 'running',
    starts,
    deadline,
    days_left,
    warning: days_left !== null && days_left >= 0 && days_left <= clock.warn_before_days,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. The roadmap
// ─────────────────────────────────────────────────────────────────────────────

function stateFor(
  step: Step,
  applies: Trilean,
  waitingOn: string[],
  done: Set<string>,
  firstUndonePosition: number,
): StepState {
  if (done.has(step.id)) return 'done';
  if (applies === 'unknown') return 'uncertain';
  if (waitingOn.length > 0) return 'waiting_on';
  // Everything at the earliest unfinished position is actionable now. Later
  // steps are shown greyed but never hidden — "אחרי הטסט אף אחד לא אמר מה השלב
  // הבא" is a documented failure, and hiding is how it happens.
  return step.sequence_position <= firstUndonePosition ? 'do_now' : 'later';
}

function buildRoadmap(facts: Facts, profile: Profile): RoadmapStep[] {
  const done = new Set(profile.completed_steps);

  // Steps that plainly do not apply are dropped. Steps we CANNOT PLACE are kept.
  const relevant = ALL_STEPS.map((step) => ({ step, applies: evaluateCondition(step.applies_when, facts) }))
    .filter(({ step, applies }) => {
      if (applies === false) return false;
      // Track filtering, once we know which track he is on.
      if (facts.track !== 'unknown' && step.track !== 'both' && step.track !== facts.track) return false;
      return true;
    });

  const included = new Set(relevant.map((r) => r.step.id));

  const notDone = relevant.filter(({ step }) => !done.has(step.id));
  const firstUndonePosition = notDone.length
    ? Math.min(...notDone.map(({ step }) => step.sequence_position))
    : Number.POSITIVE_INFINITY;

  return relevant
    .map(({ step, applies }): RoadmapStep => {
      // Only prerequisites that are actually on HIS roadmap can hold him up.
      const waiting_on = step.must_come_after.filter((id) => included.has(id) && !done.has(id));

      return {
        step,
        applies,
        state: stateFor(step, applies, waiting_on, done, firstUndonePosition),
        waiting_on,
        start_now: step.act_when === 'start_now',
        ...(typeof step.act_when === 'object' && 'before' in step.act_when
          ? { must_precede: step.act_when.before }
          : {}),
        missing_answers: applies === 'unknown' ? missingFacts(step.applies_when, facts) : [],
        checks_first: ALL_CONTINUOUS_CONDITIONS.filter(
          (c) => c.check_before.includes(step.id) && evaluateCondition(c.applies_when, facts) !== false,
        ),
      };
    })
    .sort((a, b) => {
      // ⭐ Long-lead work floats to the top regardless of where it sits in the
      // sequence. גיליון 13 principle 3: "אם מציגים אותו בסוף — המשתמש כבר איחר."
      if (a.start_now !== b.start_now) return a.start_now ? -1 : 1;
      return a.step.sequence_position - b.step.sequence_position;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Put it together
// ─────────────────────────────────────────────────────────────────────────────

export function evaluate(profile: Profile, today: IsoDate): Result {
  const facts = deriveFacts(profile, today);
  const category = categoryRuleFor(facts.nohal_category);
  const visa = visaProfileFor(profile.visa_type);

  // ── the blocker, first and alone ────────────────────────────────────────
  // ⚠️ Only a TRUE blocks. 'unknown' does not, deliberately: a wrong block is
  // worse than a missed one (F6 validation 1), and the only blocker in this
  // system rests on a status the user states outright.
  const hit = ALL_BLOCKERS.find((b) => evaluateCondition(b.applies_when, facts) === true);

  const diagnosis: Diagnosis = {
    nohal_category: facts.nohal_category,
    track: facts.track,
    has_teudat_zehut: facts.has_teudat_zehut,
    grade_ceiling: category?.grade_ceiling ?? null,
    extra_requirements: category?.extra_requirements ?? [],
    ...(visa?.caveat ? { caveat: visa.caveat } : {}),
    unanswered: [],
  };

  if (hit) {
    return {
      facts,
      diagnosis,
      blocked: {
        blocker: hit,
        days_to_expected_resolution: hit.expected_resolution_at
          ? daysBetween(today, hit.expected_resolution_at)
          : null,
      },
      roadmap: [],
      clocks: [],
      standing_conditions: [],
      warnings: checkProfile(profile, today),
    };
  }

  const roadmap = buildRoadmap(facts, profile);

  // Every question that would firm up a step he is actually being shown.
  diagnosis.unanswered = [...new Set(roadmap.flatMap((r) => r.missing_answers))].sort();

  return {
    facts,
    diagnosis,
    blocked: null,
    roadmap,
    clocks: ALL_CLOCKS.map((c) => computeClock(c, profile, facts, today)).filter(
      (c) => evaluateCondition(c.clock.applies_when, facts) !== false,
    ),
    standing_conditions: ALL_CONTINUOUS_CONDITIONS.filter(
      (c) => evaluateCondition(c.applies_when, facts) !== false,
    ),
    warnings: checkProfile(profile, today),
  };
}
