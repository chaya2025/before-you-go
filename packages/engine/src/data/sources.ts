import type { SourcePart } from '../certainty';

/**
 * ============================================================================
 * SOURCES — the four things this system knows anything from
 * ============================================================================
 *
 * Builders, so a citation is written once and every rule that leans on it says
 * so identically. From גיליון 12_מקורות.
 */

/** Checked on this date across the workbook. Drives the "re-verify me" flag. */
export const LAST_VERIFIED = '2026-08-21';
export const LAST_VERIFIED_LATE = '2026-08-24';

const NOHAL_TITLE =
  'נוהל אופן המרת רישיון נהיגה ממדינת חוץ · אגף הרישוי, משרד התחבורה · 15.2.2024 · סימוכין 4000-0017-2024-0000298';
const NOHAL_URL = 'https://www.gov.il/he/pages/1961';

const SERVICE_TITLE = 'דף השירות "הוצאת רישיון נהיגה", משרד התחבורה';
const SERVICE_URL = 'https://www.gov.il/he/service/apply_for_new_driver_drivers_license';

/**
 * 🟢 The conversion procedure. The primary source for everything about
 * entitlement. Cited by section number, not by URL — גיליון 13 principle 7:
 * "נוהל 5.3.0041 יציב; כתובות gov.il משתנות."
 */
export function nohal(section: string, claim: string, quote: string): SourcePart {
  return {
    claim,
    certainty: 'verified',
    citation: `${NOHAL_TITLE} · ${section}`,
    quote,
    url: NOHAL_URL,
    last_verified_at: LAST_VERIFIED,
    variation_factors: [],
  };
}

/**
 * 🟢 The gov.il service page. Authoritative for the from-zero route, which the
 * נוהל does not cover at all.
 */
export function servicePage(section: string, claim: string, quote: string): SourcePart {
  return {
    claim,
    certainty: 'verified',
    citation: `${SERVICE_TITLE} · סעיף "${section}"`,
    quote,
    url: SERVICE_URL,
    last_verified_at: LAST_VERIFIED,
    variation_factors: [],
  };
}

/** 🟢 Any other official page. */
export function official(
  citation: string,
  claim: string,
  quote: string,
  url?: string,
  last_verified_at: string = LAST_VERIFIED,
): SourcePart {
  return {
    claim,
    certainty: 'verified',
    citation,
    quote,
    ...(url ? { url } : {}),
    last_verified_at,
    variation_factors: [],
  };
}

/**
 * 🔵 Somebody went through it. The unique asset — גיליון 13 principle 10:
 * "אף מאגר רשמי לא יכיל אותו."
 *
 * ⚠️ The count is bookkeeping and is never shown. The user reads "עפ״י דיווחים".
 */
export function fieldReport(
  claim: string,
  opts: {
    reports?: number;
    generalizability?: 'single_report' | 'corroborated' | 'pattern';
    varies_by?: ('branch' | 'clerk_discretion' | 'visa_type' | 'date' | 'license_class')[];
    last_verified_at?: string;
  } = {},
): SourcePart {
  return {
    claim,
    certainty: 'first_hand',
    last_verified_at: opts.last_verified_at ?? LAST_VERIFIED,
    report_count: opts.reports ?? 1,
    generalizability: opts.generalizability ?? 'single_report',
    variation_factors: opts.varies_by ?? [],
  };
}

/** 🟡 Follows from an official source, but is not stated outright there. */
export function inferred(claim: string, from: string): SourcePart {
  return {
    claim,
    certainty: 'likely',
    citation: from,
    last_verified_at: LAST_VERIFIED,
    variation_factors: [],
  };
}

/**
 * ⬜ Never checked. Distinct from "checked and found nothing" — גיליון 00.
 * May not carry a citation; the certainty model enforces that.
 */
export function notChecked(claim: string): SourcePart {
  return {
    claim,
    certainty: 'unchecked',
    last_verified_at: LAST_VERIFIED,
    variation_factors: [],
  };
}

/** 🔴 Looked, and could not settle it. Carries who to ask. */
export function unresolved(claim: string, openQuestion: string): SourcePart {
  return {
    claim: `${claim} (${openQuestion})`,
    certainty: 'uncertain',
    last_verified_at: LAST_VERIFIED,
    variation_factors: [],
  };
}
