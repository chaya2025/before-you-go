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

  /** Clarifications that apply to him. Same filtering again. */
  notes: Text[];
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
/**
 * ⭐ Does this stop him acting TODAY, or does he simply need to know it?
 *
 * ⚠️ the founder, 30.8, correcting a real harm in the first version: a visa expiring
 * in three days does NOT stop anyone. He can walk into the office today and be
 * served, because the visa is valid until it expires. Putting that in the same
 * red box as "your visa has expired" would tell him to deal with it first, and
 * a person who reads that may not go at all — losing the days he still had.
 *
 * Her rule, in her words: "he can still go, but he has to renew the visa at
 * least a month before it expires... the renew a month before should be a
 * friendly reminder."
 *
 *   'blocking'  — acting today is pointless until this is dealt with.
 *   'advisory'  — carry on now. This is something to know, or to start in
 *                 parallel. It never delays anything.
 *
 * ⭐ This axis generalises past driving licences. Every government process has
 * things that genuinely stop you and things that merely need timing, and
 * collapsing the two is how official guidance becomes frightening and useless.
 */
export type UrgentSeverity = 'blocking' | 'advisory';

export type UrgentIssue = {
  id: string;

  /** See UrgentSeverity. Never render an advisory as a blocker. */
  severity: UrgentSeverity;
  title: Text;
  /** What it actually stops him doing. */
  consequence: Text;
  /** What to do about it. Never just the bad news. */
  action: Text;
  evidence: SourcePart[];
};

/**
 * ⭐ ONE DOCUMENT SECTION OF THE FORM, AND THE TWO SEPARATE THINGS IT HAS TO KNOW.
 *
 * ⚠️ Added 22.9, found by the founder: an א/2 with no teudat zehut and no licence was
 * sent to the documents screen and asked for his 89 number — while the very
 * first step of the roadmap printed underneath told him to go to the licensing
 * office and OBTAIN an 89. The same screen said both things at once.
 *
 * ⭐ Her rule, and it is now the rule of this whole screen:
 *   **a person is only ever asked for something he can actually provide.**
 *
 * Which needs two questions, not one, because they fail in different ways:
 *
 *   `ask`  — does this document belong to a person like him at all? A citizen
 *            has no visa and no 89, and that was fixed on 31.8.
 *
 *   `confirm_possession` — it belongs to him, but does he HOLD one yet? A
 *            document his own route still tells him to go and get is a document
 *            he does not have, and a text box asking him to copy a number off
 *            it is a question with no answer. So the section asks whether he
 *            has it BEFORE it asks what is printed on it.
 *
 * ⭐ The product already worked this way once and nobody noticed it was a rule:
 * the רקורד is never transcribed until `q_record` has asked whether he has one.
 * This makes that pattern the default rather than an accident of one question.
 *
 * ⚠️ Both are decided HERE, never in the website. The form is not allowed to
 * know which documents belong to which person, nor which ones the licensing
 * office is going to issue him — add a step that produces a document and the
 * possession question follows it on its own.
 */
export type DocumentQuestion = {
  /** Show this section at all. */
  ask: boolean;
  /**
   * Ask "do you have it?" first, and reveal the fields only on a yes.
   *
   * True when a step that ISSUES this document is still on his road — so he may
   * well be holding nothing, and the fields would be unanswerable.
   */
  confirm_possession: boolean;
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

  /**
   * ⭐ WHICH DOCUMENT QUESTIONS ARE WORTH ASKING THIS PERSON.
   *
   * ⚠️ Added 31.8, found by the founder: "if I choose a Toshav Israel that has a
   * driving license... when the input documents field shows the visa, he
   * doesn't have a visa if he's Israeli."
   *
   * She was right, and it was worse than she saw — the same screen also asked
   * him for his 89 number, a document he was correctly never told to obtain.
   * The form was showing every section to everybody and scoping only the
   * foreign licence.
   *
   * ⭐ THE FIX IS ARCHITECTURAL, not four `if`s in a form. The website is not
   * allowed to know which documents belong to which person — that is the rule
   * that has held since 27.8 and the one the ANCHOR_FIELD_BY_CATEGORY bug on
   * 30.8 was about. So the ENGINE decides, by asking each document its own
   * `applies_when`, and the form renders what it is told.
   *
   * ⚠️ Unknown means ASK. For a question the arithmetic is the opposite of a
   * requirement: asking one he does not need costs him a moment, while skipping
   * one he does need loses the answer entirely and silently.
   */
  document_questions: {
    form_89: DocumentQuestion;
    passport: DocumentQuestion;
    visa: DocumentQuestion;
    foreign_license: DocumentQuestion;
  };
};

/**
 * ============================================================================
 * READINESS — the question the product is named after
 * ============================================================================
 *
 * The roadmap answers "what is the whole way from here?".
 * This answers the narrower and more useful one: **"if I walked in tomorrow,
 * would what I am carrying actually work?"**
 *
 * ⭐ The unit is the DOCUMENT, not the step. That is deliberate. A step is
 * something he does; a document is something he holds, and holding the wrong
 * one is what turns a day off work into a wasted trip. The founder's own two trips
 * were both document problems, not step problems.
 *
 * ⚠️ Nothing here is recomputed. Every item is read off the roadmap that was
 * already built, so the summary at the top of the screen can never contradict
 * the steps printed underneath it. Same discipline as `Diagnosis.exemption`.
 */

/**
 * ⭐ FOUR buckets, not three, and the fourth is the honest one.
 *
 * The POC plan asked for ready / missing / mismatched. Building it exposed a
 * fourth state that those three quietly swallow: **we never asked**. A person
 * who skips the documents screen has not told us he is missing his passport —
 * he has told us nothing, and folding that into "missing" is principle 8
 * ("אל תציגי 'לא ידוע' כ'לא'") pointed at his documents. It would also produce
 * the exact harm the founder caught on 30.8: a frightening screen for a man with no
 * problem at all.
 *
 *   'ready'        — he has it, and it checks out.
 *   'mismatched'   — ⚠️ he has it and it will NOT work. The wasted trip.
 *   'missing'      — he does not have it. Either he said so, or his own roadmap
 *                    still carries the step to go and obtain it.
 *   'unconfirmed'  — nobody asked. Not a problem, not a promise.
 */
export type ReadinessBucket = 'ready' | 'mismatched' | 'missing' | 'unconfirmed';

export type ReadinessItem = {
  /** The document id, the same one used in ALL_DOCUMENTS and in requires_documents. */
  id: string;
  bucket: ReadinessBucket;
  title: Text;
  /** Why it is in this bucket, in his terms rather than the engine's. */
  detail: Text;
  /** What to do about it. ⚠️ Absent only on 'ready', where there is nothing to do. */
  action?: Text;

  /**
   * The document's own note, where it has one. Carried, not rewritten: it holds
   * the qualifications that keep the report honest — the glasses are only for
   * people who wear them, and the 89 has no expiry date at all.
   */
  note?: Text;

  /** Steps on HIS road that need it in hand. Never empty: that is how it got here. */
  needed_for: string[];

  /**
   * The step on his road that obtains or repairs it, when there is one. Lets the
   * report point at the road instead of restating it.
   */
  resolved_by?: string;

  /** Hard rule 4. The document's own sources travel with it. */
  evidence: SourcePart[];
};

/**
 * ⭐ ONE thing to do next.
 *
 * ⚠️ Not a list. גיליון 13 principle 3 and the whole failure this product exists
 * to replace — "אחרי הטסט אף אחד לא אמר מה השלב הבא" — are about a person who
 * has information and still does not know what to do on Monday morning. A
 * roadmap of fourteen steps with three of them actionable is still that person.
 *
 * `why` is not decoration. A user who is told to do something out of order will
 * assume the system is wrong unless it says why this one comes first.
 */
export type FirstAction = {
  step_id: string;
  title: Text;
  action: Text;
  why: Text;
};

/**
 * ⚠️ A verdict about the DOCUMENTS, never about the person.
 *
 * "Not ready" is not a thing this system says. A man on step one of fourteen is
 * not failing at anything, and telling him so is the same harm as putting an
 * advisory in a red box: it is discouraging, it is not true, and it is the
 * reason he does not go.
 *
 *   'ready'    — everything his road needs is in his hand and checks out.
 *   'mismatch' — ⚠️ something he holds will be rejected. Worst case, so it wins.
 *   'gaps'     — there are documents still to obtain. Ordinary, and expected.
 *   'unknown'  — we have not been told enough to say. The default, honestly.
 */
export type ReadinessVerdict = 'ready' | 'mismatch' | 'gaps' | 'unknown';

export type Readiness = {
  verdict: ReadinessVerdict;
  /** The verdict in words, written once here so every surface says the same thing. */
  headline: Text;

  ready: ReadinessItem[];
  /** ⚠️ First, always. This is the bucket that costs a day off work. */
  mismatched: ReadinessItem[];
  missing: ReadinessItem[];
  unconfirmed: ReadinessItem[];

  first_action: FirstAction | null;

  /** ⭐ "התקדמות נמדדת קדימה" — how much is done, never how much is left. */
  steps_done: number;
  steps_total: number;
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
   * ⭐ "Am I ready?" — the roadmap judged against what he is actually holding.
   *
   * ⚠️ NULL when he is blocked, and that is not laziness. A blocked person has
   * no roadmap, so there is nothing to be ready FOR, and a readiness object with
   * four empty lists would compute the verdict 'ready' and tell a man who cannot
   * proceed at all that he is good to go. Absent is the only honest value.
   */
  readiness: Readiness | null;

  /**
   * Conditions that must hold throughout, shown as a standing warning at the top
   * of the roadmap. At POC they cannot fire as alerts, because nothing is saved.
   */
  standing_conditions: ContinuousCondition[];

  /** Contradictions in his answers. Warnings only — they never stop the roadmap. */
  warnings: ProfileWarning[];
};
