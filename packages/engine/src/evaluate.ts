import type { Profile } from './profile';
import { checkProfile } from './profile';
import type { Facts, Trilean, ConditionField, NohalCategory, Track } from './condition';
import { evaluateCondition, missingFacts, anchorFieldFor } from './condition';
import type { Step, Clock } from './domain';
import { classWithinCeiling } from './domain';
import {
  ALL_STEPS,
  ALL_DOCUMENTS,
  ALL_BLOCKERS,
  ALL_CLOCKS,
  ALL_CONTINUOUS_CONDITIONS,
  visaProfileFor,
  categoryRuleFor,
} from './data';
import type { Result, RoadmapStep, ClockState, Diagnosis, StepState, UrgentIssue } from './result';
import { numbersAgree, namesAgree, resolveValidity } from './identity';
import { buildReadiness } from './readiness';
import { monthsSince, monthsUntil, ageInYears, startOfMonth, addDays, daysBetween, type IsoDate } from './dates';

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
  const anchorAnswer = profile[anchorFieldFor(nohal_category)];

  const months_since_anchor =
    anchorAnswer === 'unknown' ? 'unknown' : (monthsSince(anchorAnswer, today) ?? 'unknown');

  const age_years =
    profile.born === 'unknown' ? 'unknown' : (ageInYears(profile.born, today) ?? 'unknown');

  /**
   * ⚠️ `visa_expires` was collected and then ignored, exactly like the IDP
   * answer. A user picked his expiry month and nothing in the output moved.
   *
   * Negative means the month has already passed.
   */
  const months_until_visa_expiry = monthsUntil(profile.visa_expires, today);

  /**
   * ⭐ Extracted to identity.ts on 30.8, once the passport and the licence
   * needed exactly the same reasoning. Three copies of a rule this subtle
   * would be three chances to get one of them wrong. Read resolveValidity for
   * the four cases and why each one is what it is.
   */
  const visa_valid_now = resolveValidity(profile.visa_valid_now, months_until_visa_expiry);

  // ── the documents (ש7) ────────────────────────────────────────────────────

  const months_until_passport_expiry = monthsUntil(profile.passport_expires, today);
  const passport_valid_now = resolveValidity('unknown', months_until_passport_expiry);

  const months_until_license_expiry = monthsUntil(profile.foreign_license.expires, today);
  const foreign_license_valid = resolveValidity(
    profile.foreign_license.valid_now,
    months_until_license_expiry,
  );

  /**
   * ⭐ the founder's bug, made checkable. She renewed her passport mid-process; the
   * 89 still carried the old number, and she found out at her test.
   *
   * ⚠️ Compared and discarded. Neither number reaches the Result.
   */
  const passport_89_number_match = numbersAgree(
    profile.form_89_passport_number,
    profile.passport_number,
  );

  const passport_89_name_match = namesAgree(
    profile.form_89_name_latin,
    profile.passport_name_latin,
  );

  const passport_license_name_match = namesAgree(
    profile.foreign_license.name_latin,
    profile.passport_name_latin,
  );

  /**
   * ⭐ Holding the 89 is proved by knowing what is printed on it. Was an inline
   * Boolean inside buildRoadmap, where only that one function could see it; the
   * readiness report needs the same conclusion, so it is a fact now.
   *
   * ⚠️ true or 'unknown', never false. He may simply have skipped the screen.
   */
  const holds_form_89: Trilean =
    profile.form_89_number || profile.form_89_passport_number || profile.form_89_name_latin
      ? true
      : 'unknown';

  return {
    visa_type: profile.visa_type,
    // ⚠️ The user's answer, never the visa's default. The default is only a
    // suggestion on the confirmation screen; א/5 proves why they must stay apart.
    has_teudat_zehut: profile.has_teudat_zehut,
    visa_valid_now,
    months_until_visa_expiry,
    passport_valid_now,
    months_until_passport_expiry,
    passport_89_number_match,
    passport_89_name_match,
    passport_license_name_match,
    months_until_license_expiry,
    foreign_license_language: profile.foreign_license.language,
    holds_form_89,
    foreign_license_kind: profile.foreign_license.kind,
    foreign_license_valid,
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
 * Found by reading real output rather than by a failing test: The founder's roadmap
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

  // ⭐ A start_now step is actionable NOW, wherever it sits in the sequence.
  // That is the entire reason act_when exists apart from sequence_position:
  // the רקורד is needed last and must be begun first. Marking it 'later'
  // reproduces exactly the failure it was added to prevent —
  // "אם מציגים אותו בסוף — המשתמש כבר איחר".
  if (step.act_when === 'start_now') return 'do_now';

  // Everything at the earliest unfinished position is actionable now. Later
  // steps are shown greyed but never hidden — "אחרי הטסט אף אחד לא אמר מה השלב
  // הבא" is a documented failure, and hiding is how it happens.
  return step.sequence_position <= firstUndonePosition ? 'do_now' : 'later';
}

function buildRoadmap(facts: Facts, profile: Profile): RoadmapStep[] {
  const done = new Set(profile.completed_steps);

  /**
   * ⭐ HOLDING A DOCUMENT IS EVIDENCE, AND IT COUNTS THE SAME AS TICKING A STEP.
   *
   * ⚠️ Found by the founder on 30.8, using the documents screen the same day it was
   * built. She entered an 89 whose passport number did not match, and the
   * roadmap correctly told her to go and update it — while ALSO still telling
   * her to go and obtain an 89 for the first time. Two contradictory
   * instructions about the same document, on the same screen.
   *
   * Her rule, and it is better than a fix: the 89 field is optional precisely
   * because filling it in IS the answer. "If you have it and you input it,
   * [it is not part of the roadmap]. If you don't, it's part of the roadmap."
   *
   * You cannot know your 89 number without holding the document. So the
   * transcription is proof, and it marks the step done rather than hiding it —
   * which also unblocks everything waiting on it (fz.online_form,
   * fz.photo_and_eye) exactly as ticking the box would.
   *
   * ⭐ This is mid-process entry arriving without anyone having to declare it.
   * He came to check his documents and the system worked out where he already
   * stands.
   */
  /**
   * ⭐⭐ AND ON 31.8 IT WAS GENERALISED, because it had only ever been true of
   * ONE document.
   *
   * ⚠️ Found by reading a real Opus answer. A man who answered that he HAS his
   * רקורד was told, as the very first thing to do, to go and obtain his רקורד —
   * while the same result granted him the test exemption, which he can only
   * have BECAUSE he has it. The engine believed both at once.
   *
   * That is precisely the bug the founder found on 30.8, on a different document. The
   * rule she gave was never about the 89; it is about documents. So it is now
   * written once, over the data:
   *
   *   a step that exists to OBTAIN a document is done when the document is HELD.
   *
   * `produces_document` already says which step obtains what, and `held_when`
   * already says how we know he holds it. Nothing is special-cased, and the
   * next document to gain a `held_when` gets this for free.
   *
   * ⚠️ `=== true` only. 'unknown' must never mark a step done — that would
   * delete a step from the road of somebody who simply was not asked.
   */
  for (const step of ALL_STEPS) {
    const produced = step.produces_document;
    if (!produced) continue;
    const doc = ALL_DOCUMENTS.find((d) => d.id === produced);
    if (doc?.held_when && evaluateCondition(doc.held_when, facts) === true) {
      done.add(step.id);
    }
  }

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

        // ⚠️ Ask each document whether it applies to HIM, rather than trusting
        // the step's list. A step shared between the two channels lists what
        // either might need. `!== false` keeps documents we cannot place, so an
        // unanswered question never quietly removes a requirement.
        documents: step.requires_documents
          .map((id) => ALL_DOCUMENTS.find((d) => d.id === id))
          .filter((d): d is NonNullable<typeof d> => Boolean(d))
          .filter((d) => evaluateCondition(d.applies_when, facts) !== false),

        // Same for checklist lines. An unscoped line applies to everyone.
        checklist: step.checklist
          .filter((c) => !c.when || evaluateCondition(c.when, facts) !== false)
          .map(({ he, en }) => ({ he, en })),

        notes: step.notes
          .filter((n) => !n.when || evaluateCondition(n.when, facts) !== false)
          .map(({ he, en }) => ({ he, en })),
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
// 4. Things to deal with before the roadmap means anything
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ From the POC document:
 *   "אשרה שפג תוקפה אינה הערת שוליים במפת הדרכים — היא הופכת לשלב הראשון בה."
 *
 * ⚠️ Added 27.8 after an audit found that answering "my visa is not valid"
 * changed NOTHING in the output. The question was asked and the answer thrown
 * away — worse than not asking, because a user reasonably concludes that an
 * answer which changed nothing did not matter.
 */
function urgentIssues(
  facts: Facts,
  ceiling: { from: number; to: number } | null,
): UrgentIssue[] {
  const issues: UrgentIssue[] = [];

  /**
   * ⭐ The grade he asked for is outside what his category may be issued.
   *
   * This is NOT a rejection — he is fully eligible, just not for that grade.
   * But leaving it out of the way would let him follow a roadmap whose
   * destination does not exist, so it goes above the road rather than beside it.
   * F1 validation 3.
   */
  if (
    ceiling &&
    facts.requested_class !== 'unknown' &&
    classWithinCeiling(facts.requested_class, ceiling) === 'above'
  ) {
    issues.push({
      id: 'urgent.grade_above_ceiling',
      severity: 'blocking',
      title: {
        he: `הדרגה שביקשת (${facts.requested_class}) אינה פתוחה בפניך`,
        en: `The grade you asked for (${facts.requested_class}) is not open to you`,
      },
      consequence: {
        he: `לפי ס׳ 1(ג) לנוהל, רשות הרישוי לא תיתן לך רישיון אלא לפי תקנות ${ceiling.from}-${ceiling.to}. זו מגבלת זכאות ולא שאלה של קושי — אין מסלול המרה לאוטובוס (D) או למשאית כבדה (C, E) בשום תנאי, גם אחרי עשרות שנות נהיגה.`,
        en: `Under clause 1(c) of the procedure, the licensing authority may only issue you a licence under regulations ${ceiling.from}-${ceiling.to}. This is an entitlement limit, not a matter of difficulty — there is no conversion route to a bus (D) or a heavy truck (C, E) under any conditions, however many years you have driven one.`,
      },
      action: {
        he: `חזור ובחר דרגה בטווח ${ceiling.from}-${ceiling.to} כדי לראות את המסלול שלך. השלבים למטה נכונים לדרגות שכן פתוחות בפניך.`,
        en: `Go back and choose a grade within ${ceiling.from}-${ceiling.to} to see your route. The steps below are correct for the grades that are open to you.`,
      },
      evidence: [
        {
          claim:
            'תושב מדינת חוץ מוגבל לתקנות 176-181 — אין המרה לאוטובוס או למשאית כבדה',
          certainty: 'verified',
          citation:
            'נוהל אופן המרת רישיון נהיגה ממדינת חוץ · 15.2.2024 · ס׳ 1(ג)',
          quote:
            'ובלבד שרשות הרישוי לא תיתן לו רישיון נהיגה אלא לפי תקנות 176-181 (דרגות C1, B, A, A1, A2, 1)',
          url: 'https://www.gov.il/he/pages/1961',
          last_verified_at: '2026-08-21',
          variation_factors: [],
        },
      ],
    });
  }

  if (facts.visa_valid_now === false) {
    const visaDoc = ALL_DOCUMENTS.find((d) => d.id === 'doc.visa');
    issues.push({
      id: 'urgent.visa_expired',
      severity: 'blocking',
      title: {
        he: "האשרה שלך אינה בתוקף — זה השלב הראשון",
        en: 'Your visa is not valid — this is step one',
      },
      consequence: {
        he: "כל עוד האשרה אינה בתוקף, שום שלב בתהליך לא יתקדם. הזכאות נבחנת ליום ההגשה, ואשרה שפגה חוסמת כל פעולה מול הרשויות — לא רק במשרד הרישוי.",
        en: 'While your visa is not valid, no step will move forward. Eligibility is judged on the day you apply, and an expired visa blocks every dealing with the authorities, not only the licensing office.',
      },
      action: {
        he: "חדש את האשרה לפחות חודש מראש. החידוש מקוון ואורך כחודש. רק אחר כך קבע תורים.",
        en: 'Renew your visa at least a month in advance. Renewal is online and takes about a month. Book appointments only after that.',
      },
      evidence: visaDoc ? visaDoc.evidence : [],
    });
  }

  /**
   * ⭐ Six consecutive months abroad — ס' 1(ב), and the THIRD answer found to
   * be collected and then ignored.
   *
   * ⚠️ Found by the audit on 30.8, which reported this answer as inert for
   * every persona. It was a Profile field, a Fact and a ConditionField, and no
   * rule anywhere read it. A returning resident could answer honestly that he
   * had spent four months abroad and see exactly the same screen as a man who
   * had spent two years.
   *
   * ⭐ THE FOUNDER CHOSE THE SOFT FORM, and gave the reason the engine already
   * encodes elsewhere: a wrong block is worse than a missed one (F6 validation
   * 1). If we tell him firmly that conversion is closed and we are wrong — he
   * misremembered the dates, or the months are counted differently than we
   * read them — we have sent him down the from-zero route for months, for
   * nothing. A heads-up costs him a moment of doubt. A wrong "no" costs him
   * half a year.
   *
   * So: advisory, it names the route that IS open to him, and it never says
   * "you cannot". Same shape as the international-permit notice.
   */
  if (
    facts.nohal_category === 'toshav_israel' &&
    facts.track === 'conversion' &&
    facts.lived_abroad_6_months_continuous === false
  ) {
    issues.push({
      id: 'urgent.six_months_abroad',
      severity: 'advisory',
      title: {
        he: 'ייתכן שמסלול ההמרה אינו פתוח בפניך',
        en: 'The conversion route may not be open to you',
      },
      consequence: {
        he: 'לפי ס׳ 1(ב) לנוהל, תושב ישראל ששב זכאי להמרה רק אם שהה מחוץ לישראל שישה חודשים רצופים לפחות אחרי קבלת הרישיון הלאומי. רצופים, לא במצטבר. לפי מה שענית, ייתכן שאינך עומד בתנאי הזה. זו אינה דחייה: הוצאת רישיון מאפס פתוחה בפניך במלואה, והשלבים למטה נכונים לה.',
        en: 'Under clause 1(b), a returning Israeli resident may convert only after at least six CONSECUTIVE months abroad following the issue of the national licence. Consecutive, not cumulative. By your answer you may not meet that condition. This is not a rejection: issuing a licence from zero is fully open to you, and the steps below are correct for it.',
      },
      action: {
        he: 'שווה לוודא את התאריכים המדויקים לפני שמוותרים על ההמרה — היא קצרה משמעותית. אם אכן שהית פחות משישה חודשים רצופים, המשך לפי המסלול מאפס.',
        en: 'Worth checking your exact dates before giving up on conversion, because it is considerably shorter. If you were genuinely abroad for less than six consecutive months, follow the from-zero route.',
      },
      evidence: [
        {
          claim:
            'תושב ישראל ששב זכאי להמרה רק בתנאי שישה חודשים רצופים בחו"ל אחרי קבלת הרישיון',
          certainty: 'verified',
          citation: "נוהל אופן המרת רישיון נהיגה ממדינת חוץ · 15.2.2024 · ס' 1(ב)",
          quote:
            'תושב ישראל ששהה מחוץ לישראל שישה חודשים רצופים לפחות לאחר קבלת הרישיון הלאומי והגיש את בקשתו בתוך חמש שנים מיום שובו לישראל.',
          url: 'https://www.gov.il/he/pages/1961',
          last_verified_at: '2026-08-21',
          variation_factors: [],
        },
      ],
    });
  }

  /**
   * ⭐⭐ THE PASSPORT IS ABOUT TO EXPIRE, WHICH MEANS THE 89 IS ABOUT TO BREAK.
   *
   * ⚠️ Found by the audit on 30.8: passport_expires had been collected that
   * afternoon and used by nothing at all — the identical mistake to
   * visa_expires that morning, caught this time by a tool instead of by a
   * person losing a day.
   *
   * ⭐ And it turns out to be the most useful thing on this screen, because of
   * what it connects. Renewing a passport gives you a NEW NUMBER, and the 89
   * still carries the old one. That is exactly what happened to the founder: the
   * mismatch killed her test, which is recorded as a FAILURE rather than a
   * no-show, with the fee paid and the wait wasted.
   *
   * She found out afterwards. Anyone whose passport expires during this process
   * can be told beforehand — which is the entire product in one notice: the
   * thing nobody warns you about, said early enough to be free.
   *
   * ⚠️ ADVISORY, not blocking. Per her rule on 30.8: a document that has not
   * expired yet stops nobody. He can go to the office today. This is a second
   * trip to plan for, not a reason to stand still.
   */
  if (
    facts.months_until_passport_expiry !== 'unknown' &&
    facts.months_until_passport_expiry >= 0 &&
    facts.months_until_passport_expiry <= 6 &&
    facts.has_teudat_zehut !== true
  ) {
    const m = facts.months_until_passport_expiry;
    issues.push({
      id: 'urgent.passport_renewal_breaks_89',
      severity: 'advisory',
      title: {
        he: m === 0 ? 'הדרכון פג החודש — וזה ישבור את מסמך ה-89' : `הדרכון פג בעוד ${m} חודשים — וזה ישבור את מסמך ה-89`,
        en: m === 0 ? 'Your passport expires this month, and that will break your 89' : `Your passport expires in ${m} months, and that will break your 89`,
      },
      consequence: {
        he: 'זו אינה חסימה, ואפשר להמשיך בתהליך היום כרגיל. אבל דרכון מחודש מקבל מספר חדש, ואילו מסמך ה-89 ימשיך לשאת את המספר הישן. אי-התאמה ביניהם מונעת את קיום הטסט, והוא נרשם ככישלון ולא כאי-התייצבות: שילמת אגרה, המתנת, ונרשם לך כישלון על מבחן שלא התקיים.',
        en: 'This is not a blocker and you can carry on today as normal. But a renewed passport gets a new number, while your 89 keeps carrying the old one. A mismatch between them stops the test from happening, and it is recorded as a failure rather than a no-show: fee paid, time waited, and a failure registered for a test that never took place.',
      },
      action: {
        he: 'תכנן שתי פעולות ולא אחת: חידוש הדרכון, ואחריו תור למשרד הרישוי לעדכון מסמך ה-89. מספר ה-89 עצמו לא משתנה — מתעדכן רק הקישור לדרכון החדש. עדיף לסדר את זה לפני שקובעים טסט.',
        en: 'Plan two things, not one: renew the passport, then book a licensing office appointment to update the 89. The 89 number itself does not change; only its link to the new passport does. Better done before booking a test.',
      },
      evidence: [
        {
          claim:
            'אי-התאמה בין מספר הדרכון שבמסמך ה-89 לדרכון שברשות הנבחן מונעת את קיום הטסט, והוא נרשם ככישלון',
          certainty: 'first_hand',
          last_verified_at: '2026-08-21',
          report_count: 1,
          generalizability: 'single_report',
          variation_factors: [],
        },
      ],
    });
  }

  /**
   * ⭐ Still valid, but not for long.
   *
   * ⚠️ The threshold is NOT invented. The renewal itself is online and takes
   * about a month — the founder's own field report, 25.8, and it is already the
   * advice given in the expired-visa notice above. So two months of runway is
   * the point where "later" stops being true, because one of those months is
   * the renewal.
   *
   * ⚠️ This is deliberately NOT "expiry versus the remaining length of the
   * process". That would need a total process duration the research does not
   * have, and inventing one to look precise is the failure this system exists
   * to avoid. A floor grounded in a known fact beats a confident guess.
   *
   * Eligibility is judged on the day of submission, so a visa that lapses
   * mid-process voids work already done. That is why this sits above the road
   * rather than beside it.
   */
  if (
    facts.months_until_visa_expiry !== 'unknown' &&
    facts.months_until_visa_expiry >= 0 &&
    facts.months_until_visa_expiry <= 2 &&
    facts.visa_valid_now !== false
  ) {
    const visaDoc = ALL_DOCUMENTS.find((d) => d.id === 'doc.visa');
    const m = facts.months_until_visa_expiry;
    issues.push({
      id: 'urgent.visa_expiring_soon',
      severity: 'advisory',
      title: {
        he: m === 0 ? 'האשרה בתוקף עד סוף החודש — כדאי להתחיל לחדש' : `האשרה בתוקף עוד ${m} חודשים — כדאי להתחיל לחדש`,
        en: m === 0 ? 'Your visa is valid to the end of this month. Worth starting the renewal' : `Your visa is valid for ${m} more months. Worth starting the renewal`,
      },
      consequence: {
        he: 'זו אינה חסימה. האשרה בתוקף, ואפשר להמשיך בתהליך היום כרגיל — לקבוע תורים, להגיש ולהתייצב. מה שכן חשוב לדעת: הזכאות נבחנת ליום ההגשה, ולכן תור שנקבע למועד שאחרי התפוגה לא יעזור לך.',
        en: 'This is not a blocker. Your visa is valid and you can carry on with the process today as normal: book appointments, submit, attend. What is worth knowing: eligibility is judged on the day you submit, so an appointment booked for after the expiry will not help you.',
      },
      action: {
        he: 'התחל את חידוש האשרה במקביל, בלי לעצור שום דבר אחר. החידוש מקוון ואורך כחודש, ולכן עדיף להתחיל אותו לפני שנשאר פחות מחודש.',
        en: 'Start the visa renewal in parallel, without pausing anything else. It is done online and takes about a month, so it is better begun before less than a month is left.',
      },
      evidence: visaDoc ? visaDoc.evidence : [],
    });
  }

  /**
   * ⭐ He holds an International Driving Permit and nothing else.
   *
   * ⚠️ The ROUTING for this was already correct: deriveFacts sends idp_only to
   * the from-zero track, because an IDP is not a national licence and cannot be
   * converted. So the roadmap he sees is right.
   *
   * The harm is quieter than a wrong roadmap, and worse for being quiet. He
   * answered a question, was moved onto the LONGER route, and was never told
   * that is what happened or why. Silently rerouting somebody is exactly the
   * behaviour this product exists to replace.
   *
   * ⭐ And the fact that makes this worth surfacing at all: an IDP is issued
   * ON THE BASIS of a national licence. Anyone holding one almost certainly has
   * a national licence in their home country. Retrieving it may open the
   * conversion route, which is materially shorter. Nobody tells him that.
   *
   * Not a blocker: he is fully entitled to go from zero. F6 rule 3 — a person
   * whose route changed has to know why and on what authority.
   */
  if (facts.foreign_license_kind === 'idp_only') {
    const licenceDoc = ALL_DOCUMENTS.find((d) => d.id === 'doc.foreign_license');
    issues.push({
      id: 'urgent.idp_not_convertible',
      // Nothing is stopped: he is fully entitled to the from-zero route shown
      // below. This exists so he knows why the route changed, not to hold him up.
      severity: 'advisory',
      title: {
        he: 'רישיון בין-לאומי אינו מתקבל להמרה',
        en: 'An international permit cannot be converted',
      },
      consequence: {
        he: 'הנוהל מקבל רישיון לאומי בלבד. לכן המסלול שמוצג לך למטה הוא הוצאת רישיון מאפס, ולא המרה. זו אינה דחייה: אתה זכאי לחלוטין למסלול מאפס.',
        en: 'The procedure accepts a national licence only. That is why the route shown below is issuing a licence from zero, not conversion. This is not a rejection: you are fully entitled to the from-zero route.',
      },
      action: {
        he: 'רישיון בין-לאומי מונפק על בסיס רישיון לאומי, ולכן סביר שיש לך רישיון לאומי במדינת המוצא. אם תוכל להשיג אותו במקור ובתוקף, ייתכן שמסלול ההמרה ייפתח בפניך, והוא קצר משמעותית. שווה לבדוק לפני שמתחילים מאפס.',
        en: 'An international permit is issued on the basis of a national licence, so you probably hold a national licence in your home country. If you can obtain it, original and valid, the conversion route may open to you, and it is considerably shorter. Worth checking before starting from zero.',
      },
      evidence: licenceDoc ? licenceDoc.evidence : [],
    });
  }

  return issues;
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

  /**
   * ⚠️ Everything a CategoryRule carries — the window, the ceiling, the extra
   * requirements — comes from the CONVERSION נוהל. None of it is sourced for
   * the from-zero route, and asserting it there would be exactly the confident
   * guess this system exists to avoid.
   *
   * Found by the founder on 27.8, using the site as a citizen with no foreign
   * licence: she was being told about six consecutive months abroad and an
   * entries-and-exits form, both of which are conversion requirements and
   * meaningless to someone who has never held a licence.
   *
   * ⬜ NEW OPEN QUESTION this exposes: whether a תושב מדינת חוץ is capped at
   * 176-181 when going from ZERO too. ס' 1(ג) says it about conversion; the
   * gov.il from-zero page says nothing about foreign residents and grades.
   * Until someone asks, the honest answer on that route is "we do not know".
   */
  const conversionOnly = facts.track === 'conversion';
  const ceiling = conversionOnly ? (category?.grade_ceiling ?? null) : null;

  /**
   * ⭐ F1 validation 3, which was never implemented until the 27.8 audit caught
   * it: asking to convert to a bus or a heavy truck as a תושב מדינת חוץ used to
   * produce a perfectly ordinary conversion roadmap. It cannot end in a licence.
   * נוהל ס' 1(ג) is an entitlement limit, not a difficulty.
   */
  const requested = facts.requested_class;
  const requested_class_status =
    requested === 'unknown' ? 'unknown' : classWithinCeiling(requested, ceiling);

  const diagnosis: Diagnosis = {
    nohal_category: facts.nohal_category,
    track: facts.track,
    has_teudat_zehut: facts.has_teudat_zehut,
    grade_ceiling: ceiling,
    extra_requirements: conversionOnly ? (category?.extra_requirements ?? []) : [],
    // ⚠️ A caveat can be route-specific. Several are about conversion, and were
    // being shown to people who have never held a licence.
    ...(visa?.caveat && (!visa.caveat.when || evaluateCondition(visa.caveat.when, facts) !== false)
      ? { caveat: { he: visa.caveat.he, en: visa.caveat.en } }
      : {}),
    requested_class: requested,
    requested_class_status,
    ...(requested_class_status === 'above' && ceiling
      ? {
          ceiling_explanation: {
            he: `⚠️ הדרגה שביקשת (${requested}) אינה פתוחה בפניך. לפי ס׳ 1(ג) לנוהל, רשות הרישוי לא תיתן לך רישיון אלא לפי תקנות ${ceiling.from}-${ceiling.to}. זו מגבלת זכאות ולא שאלה של קושי — אין מסלול המרה לאוטובוס (D) או למשאית כבדה (C, E) בשום תנאי. בחר דרגה בטווח הזה כדי לראות את המסלול שלך.`,
            en: `⚠️ The grade you asked for (${requested}) is not open to you. Under clause 1(c) of the procedure, the licensing authority may only issue you a licence under regulations ${ceiling.from}-${ceiling.to}. This is an entitlement limit, not a matter of difficulty — there is no conversion route to a bus (D) or a heavy truck (C, E) under any conditions. Choose a grade in that range to see your route.`,
          },
        }
      : {}),
    exemption: 'unknown',
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
      urgent: urgentIssues(facts, ceiling),
      roadmap: [],
      clocks: [],
      /**
       * ⚠️ NULL, not an empty report. A blocked person has no road, so there is
       * nothing to be ready FOR, and four empty lists would compute the verdict
       * 'ready' and tell a man who cannot proceed at all that he is good to go.
       */
      readiness: null,
      standing_conditions: [],
      warnings: checkProfile(profile, today),
    };
  }

  const roadmap = buildRoadmap(facts, profile);

  // Every question that would firm up a step he is actually being shown.
  diagnosis.unanswered = [...new Set(roadmap.flatMap((r) => r.missing_answers))].sort();

  /**
   * Exemption is READ OFF the roadmap rather than recomputed, so the summary can
   * never disagree with the steps printed underneath it. If neither test made it
   * onto his road, he is exempt; if either is uncertain, so is the answer.
   */
  const testSteps = roadmap.filter(
    (r) => r.step.id === 'cv.eye_test' || r.step.id === 'cv.control_test',
  );
  diagnosis.exemption =
    facts.track !== 'conversion'
      ? 'unknown'
      : testSteps.length === 0
        ? 'exempt'
        : testSteps.some((r) => r.applies === 'unknown')
          ? 'unknown'
          : 'tests_required';

  return {
    facts,
    diagnosis,
    blocked: null,
    urgent: urgentIssues(facts, ceiling),
    roadmap,
    /**
     * ⭐ Built from the finished roadmap, never alongside it. The report is a
     * READING of the road, so it cannot contradict what is printed below it.
     */
    readiness: buildReadiness(facts, roadmap),
    clocks: ALL_CLOCKS.map((c) => computeClock(c, profile, facts, today))
      .filter((c) => evaluateCondition(c.clock.applies_when, facts) !== false)
      // ⭐ A clock gated on a step stays out of sight until he has done it.
      .filter((c) => !c.clock.activated_by || profile.completed_steps.includes(c.clock.activated_by)),
    standing_conditions: ALL_CONTINUOUS_CONDITIONS.filter(
      (c) => evaluateCondition(c.applies_when, facts) !== false,
    ),
    warnings: checkProfile(profile, today),
  };
}
