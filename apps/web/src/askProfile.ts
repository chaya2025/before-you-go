import { namesAgree, numbersAgree } from '@byg/engine';

/**
 * ============================================================================
 * ⭐ M6 privacy: what the chat may know about his case
 * ============================================================================
 *
 * The chat service rebuilds his road by sending his profile to the engine
 * (/api/v1/readiness). The profile the site holds also has what he typed off
 * his documents: passport and 89 numbers, his name in Latin letters. Those
 * never leave for the chat. Only the fields the engine reads to build the
 * road go, by name, and anything else (a field added later, free text) is
 * left out by default.
 *
 * ⚠️ The engine still needs what those identifiers PROVE, or the chat would
 * explain a different road from the one on his screen:
 *   - an 89 number typed in means he holds an 89 (holds_form_89: true)
 *   - the 89's passport number and today's passport agree or not
 *   - the names on the 89 and the licence agree with the passport or not
 * So the comparison runs here, in his browser, with the engine's own
 * functions, and only fixed stand-ins go out that give the same yes, no or
 * unknown. The stand-ins are the same for everyone and say nothing about him.
 */

/** Top-level fields the engine reads to build the road (packages/engine/src/profile.ts). */
const ROAD_FIELDS = [
  'language',
  'visa_type',
  'visa_valid_now',
  'visa_expires',
  'entered_israel',
  'made_aliyah',
  'returned_to_israel',
  'lived_abroad_6_months_continuous',
  'has_teudat_zehut',
  'teudat_zehut_confirmed',
  'requested_class',
  'has_record_document',
  'born',
  'holds_form_89',
  'passport_expires',
  'completed_steps',
] as const;

/** The foreign licence, minus the name printed on it. */
const LICENCE_FIELDS = ['kind', 'valid_now', 'years_held_permanent', 'held_class', 'country', 'expires', 'language'] as const;

/** Stand-ins: valid to the engine, identical for every user. */
const NUM_A = 'SAME00';
const NUM_B = 'DIFF11';
const NAME_A = 'Same Name';
const NAME_B = 'Other Name';

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

export function askProfile(profile: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ROAD_FIELDS) if (profile[k] !== undefined) out[k] = profile[k];

  const licenceIn = (profile.foreign_license ?? {}) as Record<string, unknown>;
  if (profile.foreign_license && typeof profile.foreign_license === 'object') {
    const licence: Record<string, unknown> = {};
    for (const k of LICENCE_FIELDS) if (licenceIn[k] !== undefined) licence[k] = licenceIn[k];
    out.foreign_license = licence;
  }

  // Typing anything off the 89 proves he holds one, the same rule the engine uses.
  if (str(profile.form_89_number) || str(profile.form_89_passport_number) || str(profile.form_89_name_latin)) {
    out.holds_form_89 = true;
  }

  // Passport numbers: only whether they match.
  const numbers = numbersAgree(str(profile.form_89_passport_number), str(profile.passport_number));
  if (numbers !== 'unknown') {
    out.form_89_passport_number = NUM_A;
    out.passport_number = numbers ? NUM_A : NUM_B;
  }

  // Names: both comparisons are against the passport, so it gets the base stand-in.
  const passportName = str(profile.passport_name_latin);
  const on89 = namesAgree(str(profile.form_89_name_latin), passportName);
  const onLicence = namesAgree(str(licenceIn.name_latin), passportName);
  if (on89 !== 'unknown' || onLicence !== 'unknown') out.passport_name_latin = NAME_A;
  if (on89 !== 'unknown') out.form_89_name_latin = on89 ? NAME_A : NAME_B;
  if (onLicence !== 'unknown') (out.foreign_license as Record<string, unknown>).name_latin = onLicence ? NAME_A : NAME_B;

  return out;
}
