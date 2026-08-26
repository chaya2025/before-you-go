import { z } from 'zod';

/**
 * ============================================================================
 * CERTAINTY
 * ============================================================================
 *
 * Every single thing this system tells a user carries a mark saying how well
 * we know it. That is the product's core promise, so it is the first file.
 *
 * The six marks are not invented here. They are taken from גיליון 00_מקרא_והסבר
 * of the research workbook, in Chaya's own wording.
 *
 * Two rules from the research govern everything below:
 *
 *   principle 20 (גיליון 13)
 *     "display_to_user = true תמיד. ה-evidence_tier קובע את הניסוח, לא את ההצגה."
 *     A weak mark NEVER hides a rule. It changes the wording only.
 *
 *   כלל הודאות (גיליון 00)
 *     "שורה מקבלת את הסימון של החלק החלש ביותר שהמערכת פועלת לפיו."
 *     A claim's mark is the weakest of the parts we actually act on. In the
 *     workbook this is applied by hand. Here it is computed, so it can never
 *     drift away from the evidence underneath it.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. The six marks
// ─────────────────────────────────────────────────────────────────────────────

export const CertaintyMark = z.enum([
  'verified', // 🟢 מאומת       — quoted from the נוהל or an official gov.il page
  'likely', // 🟡 סביר         — sound inference from an official source, or a solid secondary one
  'first_hand', // 🔵 דיווח יחיד   — someone actually went through it. Not written down anywhere official
  'uncertain', // 🔴 לא ודאי      — we looked and could not settle it, or sources disagree
  'unchecked', // ⬜ לא נבדק      — we never looked. NOT the same as 'uncertain'
  'in_litigation', // ⏳ בשינוי       — actively contested right now
]);
export type CertaintyMark = z.infer<typeof CertaintyMark>;

/**
 * What each mark looks like and what it licenses us to say.
 * `guidance` is the instruction to whoever writes the user-facing sentence.
 */
export const CERTAINTY_META: Record<
  CertaintyMark,
  { symbol: string; he: string; en: string; guidance: string }
> = {
  verified: {
    symbol: '🟢',
    he: 'מאומת',
    en: 'Verified',
    guidance: 'State it plainly. Quote the source.',
  },
  likely: {
    symbol: '🟡',
    he: 'סביר',
    en: 'Likely',
    guidance: 'Say "as we understand it". Never state as bare fact.',
  },
  first_hand: {
    symbol: '🔵',
    he: 'דיווח מהשטח',
    en: 'From experience',
    guidance:
      'Introduce with "עפ״י דיווחים" and give the advice straight, with its fallback. ' +
      'Never "this is how it works", and never a report count — no "n=1", no numbers. ' +
      'Decided by Chaya 2026-08-25; this overrides "יש להציג ספירת דיווחים" in גיליון 13 ' +
      'principle 11, which was written for the research, not for a user\'s screen.',
  },
  uncertain: {
    symbol: '🔴',
    he: 'לא ודאי',
    en: 'Unresolved',
    guidance: 'Never present as fact. Say what we could not settle and who to ask.',
  },
  unchecked: {
    symbol: '⬜',
    he: 'לא נבדק',
    en: 'Not checked',
    guidance:
      'Say plainly that we have not checked this, which is different from having found nothing. ' +
      'Never render "unknown" as "no" (principle 8).',
  },
  in_litigation: {
    symbol: '⏳',
    he: 'בשינוי',
    en: 'Being contested',
    guidance:
      'Always with the source, the date, and the state of the proceeding. ' +
      'Never as a settled fact, in either direction.',
  },
};

/**
 * How far a mark lets us go in asserting something, from 5 (state it) down to
 * 1 (we have not looked). Used only by the weakest-part rule below.
 *
 * ⚠️ This is NOT a ranking of usefulness. גיליון 13's "מי סמכותי למה" table is
 * explicit that for some questions a 🔵 first-hand report is MORE authoritative
 * than the official source:
 *
 *   "כמה זמן זה לוקח בפועל? ← 🔵 דיווח יחיד.
 *    המקור הרשמי נותן יעד; הדיווח נותן מציאות."
 *
 * The ranking answers one narrow question: may we say this flatly, as fact?
 */
const ASSERTABILITY: Record<CertaintyMark, number> = {
  verified: 5,
  likely: 4,
  first_hand: 3,
  uncertain: 2,
  unchecked: 1,
  in_litigation: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. One piece of evidence
// ─────────────────────────────────────────────────────────────────────────────

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const HttpUrl = z
  .string()
  .regex(/^https?:\/\/\S+$/, 'Must be an http(s) URL');

/**
 * A SourcePart backs ONE claim with ONE piece of evidence.
 *
 * A single row in the workbook often rests on several of these. Example, from
 * גיליון 05 row 12 (מספר מזהה 89):
 *   part A — the number exists                → 🟢 quoted from gov.il
 *   part B — it applies to everyone without a ת"ז, not only "עובד זר" → 🔵 one report
 * The system acts on part B, so the row is 🔵. That is כלל הודאות, and the
 * computation lives in weakestMark() below.
 */
export const SourcePart = z.object({
  /** What this specific part establishes. One claim, not a summary of the row. */
  claim: z.string().min(1),

  certainty: CertaintyMark,

  /**
   * Where it comes from, in a form that survives a website redesign.
   * גיליון 13 principle 7: "התבססי על מספרי נהלים ולא על URL —
   * נוהל 5.3.0041 יציב; כתובות gov.il משתנות."
   * e.g. 'נוהל אופן המרת רישיון נהיגה ממדינת חוץ, 15.2.2024, ס\' 1(ג)'
   */
  citation: z.string().min(1).optional(),

  /** The source's own words. Required for anything marked verified. */
  quote: z.string().min(1).optional(),

  url: HttpUrl.optional(),

  /** גיליון 13 principle 6: a rule unchecked for a year flags itself for review. */
  last_verified_at: IsoDate,

  /**
   * For first-hand evidence. Internal only — NEVER rendered to a user.
   *
   * It exists so a claim can be upgraded from single_report to corroborated
   * as reports accumulate (open question 24). The user is told "עפ״י דיווחים"
   * and nothing more: a count is research bookkeeping, not something that helps
   * anyone standing in a licensing office. Decided by Chaya 2026-08-25.
   */
  report_count: z.number().int().min(1).optional(),

  /** How far a first-hand report can be generalised. Rises only as reports accumulate. */
  generalizability: z
    .enum(['single_report', 'corroborated', 'pattern'])
    .optional(),

  /**
   * What might make this come out differently for someone else.
   * גיליון 13 principle 13: without this field we over-generalise.
   */
  variation_factors: z
    .array(z.enum(['branch', 'clerk_discretion', 'visa_type', 'date', 'license_class']))
    .default([]),

  /** For in_litigation only: where the proceeding stands, and when to look again. */
  legal_status: z.enum(['active', 'in_litigation', 'lifted']).optional(),
  expected_resolution_at: IsoDate.optional(),
});
export type SourcePart = z.infer<typeof SourcePart>;

// ─────────────────────────────────────────────────────────────────────────────
// 3. The invariants — the rules the data file cannot break
// ─────────────────────────────────────────────────────────────────────────────

/**
 * These are checked when the data file loads. A rule that breaks one of them
 * does not get a warning; it fails to load. Everything in this system that
 * matters is enforced here rather than remembered.
 */
export const CheckedSourcePart = SourcePart.superRefine((part, ctx) => {
  // 🟢 means the state wrote it down. Then show us where, in its own words.
  // Every 🟢 in the workbook carries a literal quote. This keeps that true.
  if (part.certainty === 'verified') {
    if (!part.quote) {
      ctx.addIssue({
        code: 'custom',
        path: ['quote'],
        message: 'A verified claim must carry the source\'s own words.',
      });
    }
    if (!part.citation) {
      ctx.addIssue({
        code: 'custom',
        path: ['citation'],
        message: 'A verified claim must say which procedure or page it came from.',
      });
    }
  }

  // ⬜ means nobody looked. A quote proves somebody looked.
  if (part.certainty === 'unchecked' && (part.quote || part.citation)) {
    ctx.addIssue({
      code: 'custom',
      path: ['certainty'],
      message:
        'This is marked "never checked" but carries a source. It is 🟡 or 🟢, not ⬜.',
    });
  }

  // ⏳ has to say where the proceeding stands, or the user cannot judge it.
  if (part.certainty === 'in_litigation' && !part.legal_status) {
    ctx.addIssue({
      code: 'custom',
      path: ['legal_status'],
      message: 'A contested rule must state the status of the proceeding.',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. כלל הודאות, computed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The mark a claim gets, given the parts the system acts on.
 *
 * "שורה מקבלת את הסימון של החלק החלש ביותר שהמערכת פועלת לפיו" (גיליון 00).
 *
 * Pass only the parts actually used. A part we quote for background but do not
 * act on must not drag the mark down.
 *
 * `in_litigation` is contagious rather than ranked: if any part of a claim is
 * being fought over in court, the whole claim is.
 */
export function weakestMark(parts: readonly SourcePart[]): CertaintyMark {
  if (parts.length === 0) return 'unchecked';

  if (parts.some((p) => p.certainty === 'in_litigation')) return 'in_litigation';

  let weakest = parts[0]!.certainty;
  for (const part of parts) {
    if (ASSERTABILITY[part.certainty] < ASSERTABILITY[weakest]) {
      weakest = part.certainty;
    }
  }
  return weakest;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. How it reaches the user
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ The computed mark above is an INTERNAL safety property. It answers
 * "may the engine treat this as a hard rule?" and nothing else.
 *
 * It is NOT a badge stamped on the user's screen. Chaya, 2026-08-25:
 *
 *   "the green is literally what the government says and the blue is what
 *    happened to me and worked and i want other users to do so too... don't
 *    ignore both. always rely on the green but for sure say the blue too."
 *
 * Marking a whole step 🔵 reads as "do not trust this", and the user then
 * ignores advice that is correct and hard-won. So the user is never shown a
 * row-level mark. Each part is attributed in its own voice, official first,
 * reported second, in one sentence.
 */

/** How each kind of evidence introduces itself in the user's own language. */
export const LEAD_IN: Record<CertaintyMark, { he: string; en: string }> = {
  // Stated flatly. The authority is named separately, from `citation`.
  verified: { he: '', en: '' },
  likely: { he: 'ככל הנראה', en: 'As best we understand' },
  first_hand: { he: 'עפ״י דיווחים', en: 'From what people report' },
  uncertain: { he: 'לא הצלחנו לאמת', en: 'We could not confirm' },
  unchecked: { he: 'לא בדקנו את זה', en: 'We have not checked this' },
  in_litigation: { he: 'נכון להיום, ותלוי ועומד', en: 'As of today, and under challenge' },
};

export type Attribution = {
  claim: string;
  mark: CertaintyMark;
  /** The phrase this part opens with. Empty for official facts, which are simply stated. */
  lead_in: { he: string; en: string };
  /** Which procedure or page said so. Shown next to official facts. */
  citation?: string;
  quote?: string;
  url?: string;
};

/**
 * Turns the evidence behind one claim into the pieces a sentence gets built
 * from. Official parts come first because entitlement rests on them; reported
 * parts follow because that is what actually happens at the desk.
 *
 * Nothing is dropped. That is principle 20 and it is not negotiable:
 * a low mark changes the wording, never the visibility.
 */
export function attributions(parts: readonly SourcePart[]): {
  official: Attribution[];
  reported: Attribution[];
  /** Internal only. Governs engine behaviour, never rendered as a label. */
  internal_mark: CertaintyMark;
} {
  const toAttribution = (p: SourcePart): Attribution => ({
    claim: p.claim,
    mark: p.certainty,
    lead_in: LEAD_IN[p.certainty],
    ...(p.citation ? { citation: p.citation } : {}),
    ...(p.quote ? { quote: p.quote } : {}),
    ...(p.url ? { url: p.url } : {}),
  });

  const isOfficial = (p: SourcePart) =>
    p.certainty === 'verified' || p.certainty === 'likely' || p.certainty === 'in_litigation';

  return {
    official: parts.filter(isOfficial).map(toAttribution),
    reported: parts.filter((p) => !isOfficial(p)).map(toAttribution),
    internal_mark: weakestMark(parts),
  };
}

/**
 * The full picture behind a claim: the internal mark, the wording rules, every
 * piece of evidence, and which parts set the mark. Used for "why does it say
 * that?" and for the tests. Not a display format.
 */
export function explainCertainty(parts: readonly SourcePart[]) {
  const mark = weakestMark(parts);
  return {
    mark,
    ...CERTAINTY_META[mark],
    /** The parts that set the mark. This is what a "why?" link would show. */
    determined_by: parts.filter((p) => p.certainty === mark),
    all_parts: parts,
  };
}
