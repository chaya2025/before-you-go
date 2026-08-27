import { z } from 'zod';
import { CheckedSourcePart } from './certainty';
import { Condition } from './condition';

/**
 * ============================================================================
 * DOMAIN — what a step, a blocker, a clock and a document ARE
 * ============================================================================
 *
 * Shapes only. No licence rules live in this file; those are data, and data
 * carries its own sources. Modelled on גיליון 13_סכמת_נתונים, trimmed to what
 * the POC needs and extended where the research demanded it.
 */

/** Every user-facing string exists in both languages. English first: the first users are Anglos. */
export const Text = z.object({ he: z.string().min(1), en: z.string().min(1) });
export type Text = z.infer<typeof Text>;

/**
 * A checklist line, optionally scoped to who it applies to.
 *
 * ⚠️ Added 27.8. Chaya, using the site as a citizen with a teudat zehut and no
 * foreign licence: "it still gives me the option of an 8-9... make sure to be
 * specific to the actual route where things apply."
 *
 * She was right. Steps shared between the two channels were carrying checklist
 * lines written for the no-teudat-zehut case — asking a citizen whether he has
 * his 89 document, which he was correctly never told to get. `when` scopes the
 * line to the person it is actually about.
 */
export const ChecklistItem = Text.extend({ when: Condition.optional() });
export type ChecklistItem = z.infer<typeof ChecklistItem>;

/**
 * ⚠️ Every requirement shown to a user cites where it came from (hard rule 4).
 * `.min(1)` is doing real work here: a step with an empty evidence array fails
 * to load. There is no way to add an unsourced requirement to this system.
 */
const Evidence = z.array(CheckedSourcePart).min(1);

// ─────────────────────────────────────────────────────────────────────────────
// Channel — the central finding of the research
// ─────────────────────────────────────────────────────────────────────────────

/**
 * גיליון F0: "ת״ז אינה משנה זכאות, היא משנה ערוץ." Same step, different channel.
 * A person with no teudat zehut is entitled to exactly the same licence; what
 * changes is that online steps become physical visits with an appointment.
 *
 * ⚠️ Design rule that follows, and it is absolute:
 * never show "אינך זכאי" to someone without a teudat zehut. The only block in
 * this system is 2(א)(5).
 */
export const Channel = z.enum([
  'online',
  'licensing_office', // משרד הרישוי
  'post_office', // סניף דואר
  'photo_station', // תחנת צילום
  'driving_school', // בית ספר לנהיגה
  'test_center', // מרכז בחינות
  'population_authority', // רשות האוכלוסין
  'origin_country', // e.g. the רקורד
  'mail', // arrives by post
  'unknown',
]);

export const Step = z.object({
  id: z.string().min(1),
  track: z.enum(['conversion', 'from_zero', 'both']),

  title: Text,
  /** What he actually does. An instruction, not a description. */
  action: Text,

  applies_when: Condition,

  /** Where it sits in the printed roadmap. */
  sequence_position: z.number().int(),

  /**
   * ⭐ Separate from sequence_position, and this is גיליון 13 principle 3
   * generalised: the רקורד is needed at the END but must be STARTED on day one,
   * because it depends on a foreign authority. "אם מציגים אותו בסוף — המשתמש כבר איחר."
   *
   * 'start_now'    — begin immediately regardless of position
   * 'when_reached' — ordinary
   * 'before'       — must be done BEFORE the step named, even though it comes after
   *                  it in the list. This is the תור-before-the-טסט rule.
   */
  act_when: z.union([
    z.literal('start_now'),
    z.literal('when_reached'),
    z.object({ before: z.string().min(1) }),
  ]).default('when_reached'),

  /** ordering_constraint. Getting these backwards costs a wasted visit each time. */
  must_come_after: z.array(z.string()).default([]),

  /** Roughly how long the outside world takes. Drives what surfaces early. */
  lead_time_days: z.number().int().min(0).optional(),

  channel: Channel,
  requires_appointment: z.union([z.boolean(), z.literal('unknown')]).default('unknown'),
  authority: z.string().optional(),

  /** Document ids needed in hand for this step. */
  requires_documents: z.array(z.string()).default([]),

  /**
   * Where he actually goes to do it. Added 2026-08-26 at Chaya's request:
   * a roadmap that names a step and then makes him search for the form is
   * doing half the job.
   */
  links: z
    .array(z.object({ label: Text, url: z.string().regex(/^https?:\/\/\S+$/) }))
    .default([]),

  /**
   * Checks to run before this step, especially before a physical visit.
   * גיליון 13 principle 15 — a wasted visit costs a day off work and an
   * appointment that is hard to get.
   */
  checklist: z.array(ChecklistItem).default([]),

  /**
   * ⭐ Chaya's rule, and it has no equivalent in גיליון 13:
   *   "אל תרככי את העצה, בני לתוכה נפילה לאחור."
   * Where the evidence is thin, do not hedge the advice — give the advice with
   * its recovery built in, so it is right either way:
   *   "לך בלי תור, ואם דוחים — קבע תור באותו רגע."
   */
  fallback: Text.optional(),

  /**
   * Optional, and never summed into a total (principle 22: cost is planning and
   * progress, never a discouraging headline). Only amounts that carry evidence
   * appear at all.
   */
  cost: z
    .object({
      amount_ils: z.number().min(0).optional(),
      max_ils: z.number().min(0).optional(),
      note: Text.optional(),
      evidence: Evidence,
    })
    .optional(),

  evidence: Evidence,
});

/** A step after parsing: every default filled in. This is what the engine reads. */
export type Step = z.infer<typeof Step>;

/**
 * A step as WRITTEN in the data file, before parsing: fields with defaults may
 * be left out. Data files are authored as StepInput and parsed into Step on
 * load, which is what makes a malformed rule fail at import rather than at
 * runtime in front of a user.
 */
export type StepInput = z.input<typeof Step>;

/**
 * Step, plus the rule about what may back it. Used at load time.
 *
 * ⚠️ Spotted by Chaya 2026-08-25, and it was a real gap. `evidence.min(1)` only
 * demanded that SOMETHING be attached — so a step whose sole evidence was
 * ⬜ "never checked" would have loaded happily. That is a step with no reason to
 * believe it at all, telling a user to go and do something.
 *
 * ⭐ What this rule does NOT demand is an official source. A 🔵 field report is
 * evidence, and four steps in this system rest on nothing else: the היתר, its
 * fee, the completion declaration, and the plastic-card fee. None of them is
 * documented anywhere official, all of them happen, and they are the reason this
 * product is worth building. גיליון 13's "מי סמכותי למה" table settles it —
 * for "what actually happens at the desk", the report IS the authority.
 *
 * So: at least one part that is not ⬜. Official, inferred, reported, contested,
 * even unresolved — any of those is a reason. "We never looked" is not.
 */
export const CheckedStep = Step.superRefine((step, ctx) => {
  if (step.evidence.every((part) => part.certainty === 'unchecked')) {
    ctx.addIssue({
      code: 'custom',
      path: ['evidence'],
      message:
        `Step "${step.id}" is backed only by "never checked". ` +
        'A step that tells someone to act needs at least one reason to believe it — ' +
        'an official source, an inference, or a field report.',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// The two-axis model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ The central correction of the whole research, and the one that costs people
 * their licence when it is got wrong:
 *
 *   axis 1 — nohal_category decides ELIGIBILITY: the window, and the grade ceiling.
 *   axis 2 — has_teudat_zehut decides the CHANNEL: online, or a physical queue.
 *
 * They are independent. א/5 holds a teudat zehut AND sits in תושב מדינת חוץ,
 * capped at 176-181. Deriving one axis from the other is the classic failure.
 *
 * So `usually_has_teudat_zehut` below is a DEFAULT for the ש4 confirmation
 * screen. It is never used as an eligibility input.
 */
export const VisaProfile = z.object({
  visa_type: z.string().min(1),
  label: Text,
  nohal_category: z.enum([
    'oleh_chadash',
    'toshav_israel',
    'toshav_medinat_chutz',
    'not_defined_in_nohal',
  ]),
  /** What the ש4 screen suggests. The user's answer overrides it, always. */
  usually_has_teudat_zehut: z.union([z.boolean(), z.literal('unknown')]),
  /** The physical document he actually carries. Used to word the ש4 screen. */
  identity_document: Text,
  /** Anything true of this status specifically. The ב/2 short-visa trap lives here. */
  caveat: Text.optional(),
  evidence: Evidence,
});
export type VisaProfile = z.infer<typeof VisaProfile>;
export type VisaProfileInput = z.input<typeof VisaProfile>;

/**
 * What each category gets. ס' 1(א), 1(ב) and 1(ג) of the נוהל, one clause each.
 */
export const CategoryRule = z.object({
  category: z.enum([
    'oleh_chadash',
    'toshav_israel',
    'toshav_medinat_chutz',
    'not_defined_in_nohal',
  ]),
  label: Text,

  /** Five years for all three defined categories. The ANCHOR is what differs. */
  conversion_window_years: z.number().int().min(1).optional(),

  /**
   * ⚠️ `anchor_differs_by_status`. Not interchangeable, and using the wrong one
   * silently computes the wrong deadline.
   */
  window_anchor: z.enum(['aliyah', 'return', 'entry']).optional(),

  /**
   * The grades the authority may issue him. 176-185 for the two Israeli-side
   * categories, 176-181 for a foreign resident — no bus, no heavy truck, ever.
   */
  grade_ceiling: z.object({ from: z.number().int(), to: z.number().int() }).optional(),

  /** Extra conditions for this category alone, e.g. the six months abroad. */
  extra_requirements: z.array(Text).default([]),

  evidence: Evidence,
});
export type CategoryRule = z.infer<typeof CategoryRule>;
export type CategoryRuleInput = z.input<typeof CategoryRule>;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * An absolute stop. There is exactly ONE in this system.
 *
 * גיליון F6: built so that a single field flips it. If the בג"ץ petition
 * succeeds, `legal_status: 'lifted'` opens F3 and F5 to a whole population with
 * no other change to the code.
 */
export const Blocker = z.object({
  id: z.string().min(1),
  applies_when: Condition,
  title: Text,
  /** What blocks him, on whose authority, and that it is being contested. */
  explanation: Text,
  legal_status: z.enum(['active', 'in_litigation', 'lifted']),
  expected_resolution_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Never a dead end. Who can actually help. */
  referrals: z.array(z.object({ name: Text, url: z.string().optional() })).default([]),
  evidence: Evidence,
});
export type Blocker = z.infer<typeof Blocker>;
export type BlockerInput = z.input<typeof Blocker>;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * A period counted from an event. There are five of these and conflating any
 * two of them is the single most common way people lose years they still had.
 */
export const Clock = z.object({
  id: z.string().min(1),
  name: Text,
  applies_when: Condition,

  /**
   * ⚠️ `anchor_differs_by_status`. 'category_anchor' resolves to whichever of
   * עלייה / שיבה / כניסה applies to his category. The others are process events.
   */
  anchor: z.enum([
    'category_anchor',
    /**
     * ⚠️ Distinct from category_anchor on purpose. The one-year driving clock is
     * quoted as "מיום הכניסה לישראל" for everyone, including an עולה whose
     * five-year conversion window counts from עלייה instead. Same person, two
     * clocks, two different starting dates.
     */
    'entry_to_israel',
    'license_issued', // ⭐ NOT test_passed. For a citizen they coincide; without
    // a teudat zehut the gap can be months, and every day of it
    // is pushed onto the end of the ליווי period.
    'test_passed',
    'theory_passed',
    'duplicate_fee_paid', // the 48-hour window
    'medical_declaration',
  ]),

  duration_days: z.number().int().min(1),

  /** What actually happens when it runs out. Not always "you lost your chance". */
  on_expiry: Text,

  /** Warn this far ahead. The נוהל itself recommends 60 days for the conversion window. */
  warn_before_days: z.number().int().min(0).default(0),

  evidence: Evidence,
});
export type Clock = z.infer<typeof Clock>;
export type ClockInput = z.input<typeof Clock>;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ The most important insight in the research, in Chaya's words:
 * a completed step can be voided silently. A visa that lapsed or a passport
 * that was renewed knocks down steps you already passed, and you find out at
 * the test, which is the most expensive possible moment.
 *
 * A roadmap modelled as a flat list cannot represent this. That is why these
 * are re-checked before every physical visit, not once at the start.
 */
export const ContinuousCondition = z.object({
  id: z.string().min(1),
  name: Text,
  applies_when: Condition,
  /** Asked before each of these steps, every time. */
  check_before: z.array(z.string()).default([]),
  consequence_if_invalid: Text,
  /** What to do about it. Never just the bad news. */
  remedy: Text,
  evidence: Evidence,
});
export type ContinuousCondition = z.infer<typeof ContinuousCondition>;
export type ContinuousConditionInput = z.input<typeof ContinuousCondition>;

// ─────────────────────────────────────────────────────────────────────────────

export const RequiredDocument = z.object({
  id: z.string().min(1),
  name: Text,
  applies_when: Condition,
  issued_by: Text,
  /** "חייב מקור?" — an original, or is a copy or an email enough? */
  must_be_original: z.union([z.boolean(), z.literal('unknown')]).default('unknown'),
  accepts_email: z.boolean().default(false),
  notes: Text.optional(),
  evidence: Evidence,
});
export type RequiredDocument = z.infer<typeof RequiredDocument>;
export type RequiredDocumentInput = z.input<typeof RequiredDocument>;

// ─────────────────────────────────────────────────────────────────────────────
// Grade ↔ regulation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * גיליון 06, open question 18, closed 21.8 against תקנות התעבורה תשכ"א-1961.
 * Each regulation's own heading names its grade, so this is quoted, not inferred.
 *
 * ⚠️ The engine reasons in NUMBERS, because that is how the נוהל writes the two
 * boundaries that matter, and they are one apart:
 *   176-181 → the ceiling for תושב מדינת חוץ, and where מבחן שליטה is required
 *   176-180 → where the exemption applies
 * C1 (181) therefore always requires מבחן שליטה, even after twenty years.
 */
export const CLASS_TO_REGULATION: Record<string, number> = {
  A2: 176,
  A1: 177,
  A: 178,
  '1': 179,
  B: 180,
  C1: 181,
};

export const FOREIGN_RESIDENT_CEILING = { from: 176, to: 181 } as const;
export const EXEMPTION_RANGE = { from: 176, to: 180 } as const;

export function regulationFor(licenseClass: string): number | undefined {
  return CLASS_TO_REGULATION[licenseClass];
}

/**
 * The heavy grades sit in תקנות 182-185.
 *
 * ⚠️ Deliberately a BAND, not a per-grade mapping. גיליון 06 closed question 18
 * for 176-181 by quoting each regulation's own heading, but stopped there:
 * "נותרו 182-185 (E, C, D, D1, D2, D3) — לא מופו לתקנה בודדת".
 * Inventing which of them is 183 would be exactly the kind of confident guess
 * this system exists to avoid, and nothing here needs it — the only question
 * that matters is whether a grade sits above a category's ceiling.
 */
export const HEAVY_CLASS_BAND = { from: 182, to: 185 } as const;
export const HEAVY_CLASSES = ['C', 'D', 'D1', 'D2', 'D3', 'E'] as const;

/** The lowest regulation a grade could belong to. Enough to compare against a ceiling. */
export function regulationBandFor(licenseClass: string): { from: number; to: number } | undefined {
  const exact = CLASS_TO_REGULATION[licenseClass];
  if (exact !== undefined) return { from: exact, to: exact };
  if ((HEAVY_CLASSES as readonly string[]).includes(licenseClass)) return { ...HEAVY_CLASS_BAND };
  return undefined;
}

/**
 * ⭐ Is this grade available to this category at all?
 *
 * נוהל ס' 1(ג) on תושב מדינת חוץ: "ובלבד שרשות הרישוי לא תיתן לו רישיון נהיגה
 * אלא לפי תקנות 176-181". That is an ENTITLEMENT limit, not a difficulty — there
 * is no conversion route to a bus or a heavy truck under any conditions.
 *
 * F1 validation 3 requires the system to say so rather than quietly building a
 * roadmap that cannot end in a licence.
 */
export function classWithinCeiling(
  licenseClass: string,
  ceiling: { from: number; to: number } | null | undefined,
): 'within' | 'above' | 'unknown' {
  if (!ceiling) return 'unknown';
  const band = regulationBandFor(licenseClass);
  if (!band) return 'unknown';
  return band.from > ceiling.to ? 'above' : 'within';
}
