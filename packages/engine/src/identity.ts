import type { Trilean } from './condition';

/**
 * ============================================================================
 * IDENTITY — comparing what is printed on two documents
 * ============================================================================
 *
 * ⭐ the founder's design rule, 30.8: do not ask the user about the RULES. Ask him to
 * read what is printed in front of him, and let the system find the problem.
 *
 * He should never have to know that his 89 and his passport are linked, or that
 * renewing one silently breaks the other. He transcribes what he sees. This
 * file notices that the two disagree.
 *
 * ⚠️ PRIVACY (hard rule 1). Everything here takes values in and returns a
 * yes/no/unknown. No identifier is stored, logged, or returned. Nothing
 * downstream may echo a passport number back to the screen.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Document numbers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Case, spaces and punctuation are how the SAME number gets typed two ways.
 * "AB 123456" and "ab-123456" are one passport, and flagging them as a mismatch
 * would send somebody to the licensing office to fix nothing.
 */
function normaliseNumber(value: string): string {
  return value.replace(/[^0-9a-z]/gi, '').toUpperCase();
}

/**
 * Do these two document numbers refer to the same document?
 *
 * ⚠️ Returns 'unknown' unless BOTH are present. A missing answer can never
 * become a mismatch — that is the same rule as everywhere else in this engine,
 * and here it matters more than usual: a false mismatch sends a person to book
 * an appointment he does not need.
 */
export function numbersAgree(a: string | undefined, b: string | undefined): Trilean {
  if (!a || !b) return 'unknown';
  return normaliseNumber(a) === normaliseNumber(b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Names
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ The failure the founder could not hit, being fluent in Hebrew and English and
 * born here.
 *
 * A name written in Cyrillic, Amharic, Arabic or Chinese is transliterated
 * separately onto every document a person owns, and the spellings do not agree.
 * Olexandr · Oleksandr · Alexander. Yosef · Yossef. A married name on the newer
 * document and a maiden name on the older one.
 *
 * Normalisation, and why each part is here:
 *   - accents stripped, because "José" and "Jose" are one man
 *   - lowercased, because documents shout in capitals and forms do not
 *   - punctuation dropped, so "O'Brien" and "OBrien" agree
 *   - ⭐ WORDS SORTED, because half the world prints the surname first. "SMITH
 *     JOHN" and "John Smith" are the same person, and telling him to go and
 *     correct his name would be wrong and expensive.
 *
 * ⚠️ What deliberately still counts as a difference: a missing middle name.
 * That is a real spelling difference between two documents and it does cause
 * friction at the desk, so the engine says the documents differ.
 *
 * ⚠️ And note what this function does NOT decide. It reports that two documents
 * disagree. Whether a clerk will accept the difference is not ours to promise —
 * the consequence carries 🟡, not 🟢.
 */
function normaliseName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents: Jose === José
    .toLowerCase()
    // ⚠️ Apostrophes JOIN, hyphens SEPARATE, and they cannot share a rule.
    // O'Brien must equal OBrien (one word), while ANNA-MARIA must equal
    // anna maria (two words). Caught by a test before anything depended on it.
    .replace(/['’`]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/**
 * Do these two documents carry the same name?
 *
 * 'unknown' unless both are present. Same reason as numbersAgree: a person must
 * never be sent to fix a problem invented by a blank field.
 */
export function namesAgree(a: string | undefined, b: string | undefined): Trilean {
  if (!a || !b) return 'unknown';
  const left = normaliseName(a);
  const right = normaliseName(b);
  if (!left || !right) return 'unknown';
  return left === right;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validity, from a self-report and an expiry month
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ TWO ANSWERS THAT CAN DISAGREE, resolved without ever guessing.
 *
 * Extracted 30.8. The visa worked this way first; the passport and the foreign
 * licence need exactly the same reasoning, and three copies of a rule this
 * subtle is three chances to get one of them wrong.
 *
 * Every document here is asked about twice: "is it valid?" and "when does it
 * expire?". Four cases, and only one of them is obvious.
 *
 *   1. HE SAYS NO → no. Whatever the date says.
 *      A document can be revoked, cancelled, surrendered or replaced long
 *      before its printed expiry. He knows something the date cannot show, and
 *      overruling him with arithmetic would tell a man holding nothing that he
 *      is fine.
 *
 *   2. THE DATE HAS PASSED, and he did not claim otherwise → expired.
 *      Here the date is real evidence and it is allowed to decide.
 *
 *   3. ⭐ THE DATE HAS PASSED but he says it IS valid → 'unknown'.
 *      Probably a renewed document with the old date still typed in, but
 *      possibly a misread. Two credible answers point opposite ways, so the
 *      engine says it does not know rather than picking a side, and the caller
 *      raises a warning asking him to check. That is this product's whole
 *      thesis, applied to its own inputs.
 *
 *   4. THE EXPIRY MONTH IS THIS MONTH → whatever he said.
 *      The answer is a MONTH, not a day. We cannot tell whether the day has
 *      passed. He can. We defer.
 *
 * ⚠️ A missing date can never make a document expired.
 */
export function resolveValidity(
  selfReport: Trilean,
  monthsUntilExpiry: number | 'unknown',
): Trilean {
  if (selfReport === false) return false;
  if (monthsUntilExpiry === 'unknown') return selfReport;
  if (monthsUntilExpiry < 0) return selfReport === true ? 'unknown' : false;
  if (monthsUntilExpiry === 0) return selfReport;
  return true;
}

/** True when he claims valid but the month he gave has already gone. */
export function claimsValidButDateHasPassed(
  selfReport: Trilean,
  monthsUntilExpiry: number | 'unknown',
): boolean {
  return selfReport === true && monthsUntilExpiry !== 'unknown' && monthsUntilExpiry < 0;
}
