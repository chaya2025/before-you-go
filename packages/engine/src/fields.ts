import type { Text } from './domain';
import type { IsoDate } from './dates';

/**
 * ============================================================================
 * FIELDS — what a person is allowed to type, and what to say when he does not
 * ============================================================================
 *
 * ⚠️ Chaya, 31.8, and she was right:
 *   "at the moment a user can just input anything not relevant and it will go
 *    through normally and give wrong result."
 *
 * ⭐ WHY THIS LIVES IN THE ENGINE AND NOT IN THE FORM. The website already holds
 * no domain knowledge — it does not know the visa types and it does not decide
 * which date to ask for. "What a passport number looks like" is the same kind of
 * fact. Putting it here means the rule exists once, the API cannot be handed
 * something the form would have refused, and the message a user reads is
 * written in both languages beside the rule that produced it.
 *
 * ⭐ AND THE SEVERITY AXIS IS HERS, reused. She invented it on 30.8 for the
 * notices above the roadmap, and it is exactly the right split here too:
 *
 *   'blocking'  — we cannot use this. Letters in a number field are not an
 *                 opinion, and a wrong answer built on them is worse than no
 *                 answer. The form will not submit.
 *   'advisory'  — ⚠️ this looks odd, and we may be the ones who are wrong. A
 *                 passport expiring in forty years is probably a typo, but F1
 *                 validation 2 is explicit: "המערכת מבקשת אישור במקום לחסום."
 *                 He is asked to confirm, and he can carry on.
 *
 * ⚠️ Nothing in here rejects a person. It rejects TEXT. There is exactly one
 * block in this whole system and it is 2(א)(5).
 */

export type FieldProblem = {
  severity: 'blocking' | 'advisory';
  message: Text;
};

const blocking = (he: string, en: string): FieldProblem => ({ severity: 'blocking', message: { he, en } });
const advisory = (he: string, en: string): FieldProblem => ({ severity: 'advisory', message: { he, en } });

// ─────────────────────────────────────────────────────────────────────────────
// The patterns. Exported, because the Profile schema validates against the
// SAME expressions — one definition, so the form and the API cannot disagree.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ SPACES AND HYPHENS ARE ALLOWED, and stripped before anything is checked.
 *
 * ⭐ A test caught this within a minute of the first version, and it was a real
 * mistake of mine. The first rule rejected "AB-1234567" — but identity.ts has
 * always normalised punctuation away on purpose, because "AB 123456" and
 * "ab-123456" are one passport, and flagging them apart "would send somebody to
 * the licensing office to fix nothing." Documents print numbers with spaces in
 * them, and this screen asks him to copy what is printed. Refusing his honest
 * transcription would be strictness that costs a real person his answer.
 *
 * So: these rules reject GARBAGE, not punctuation.
 */
export const stripPunctuation = (value: string): string => value.replace(/[\s\-‐-―]/g, '');

/**
 * Nine digits, beginning 89.
 *
 * The PREFIX is official: gov.il, "הוצאת רישיון נהיגה לעובד זר" —
 * "במשרד הרישוי יונפק מספר זיהוי פיקטיבי המתחיל בספרות 89."
 *
 * ⭐ The LENGTH is Chaya, 31.8, reading her own document: "there are 9 digits in
 * the 89." It was a ⬜ open guess for exactly one day — the first version capped
 * the length arbitrarily and said in writing that it was an anti-paste guard and
 * not a claim, so that it could be replaced the moment somebody looked. Somebody
 * looked.
 *
 * 🔵 A single first-hand report, and that is the right authority for this
 * question. גיליון 13's "מי סמכותי למה" table settles it: for what a document
 * physically IS, the person holding one outranks a procedure that never
 * describes it. It also corroborates from the other direction — the 89 number
 * substitutes for a teudat zehut number, and an Israeli identity number is nine
 * digits.
 *
 * ⚠️ If a second person reports a different length, this is the one line to
 * change, and the count belongs in doc.form_89's evidence beside it.
 */
export const FORM_89_NUMBER = /^89\d{7}$/;

/**
 * ⚠️ AT LEAST ONE DIGIT, and this is the one judgement call in this file.
 *
 * Without it "i dont know" is letters and spaces of a plausible length and
 * sails straight through. A phrase in this field then disagrees with the real
 * number on the other document, which puts "go and update your 89" on his road
 * and sends him to book an appointment he does not need. That is the wasted
 * trip, caused by a text box.
 *
 * ⬜ NOT VERIFIED as a universal. Every passport numbering scheme I can point at
 * contains digits, but "every passport on earth" was never checked. It is a
 * heuristic, it is written down as one, and it is one line to change the day
 * somebody turns up with a counter-example.
 */
export const PASSPORT_NUMBER = /^(?=.*\d)[A-Za-z0-9]{5,20}$/;

/**
 * ⚠️ Latin letters, spaces, hyphens, apostrophes and full stops.
 *
 * `\p{L}` would be more welcoming and would be wrong. namesAgree normalises a
 * name to [a-z], so one typed in Hebrew or Cyrillic reduces to an empty string,
 * the comparison returns 'unknown', and nothing is checked at all. The field
 * asks for the name "as printed in your passport, in Latin letters" precisely
 * because that is the only version two documents can be compared on. Saying so
 * is better than accepting it and silently checking nothing.
 *
 * Accents are allowed. José is a name, not a typo.
 */
export const LATIN_NAME = /^[\p{Script=Latin}\s'’\-.]{2,60}$/u;

// ─────────────────────────────────────────────────────────────────────────────
// The checks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Every check returns null for an EMPTY value.
 *
 * This screen is optional in full (F1 rule 6) and optional field by field. An
 * empty box is not a wrong answer, it is no answer, and the engine already has
 * a first-class way to handle that. Turning a blank into a red message would
 * make a skippable screen feel like a locked form.
 */
export function checkForm89Number(value: string): FieldProblem | null {
  const v = stripPunctuation(value.trim());
  if (!v) return null;
  if (/[^0-9]/.test(v)) {
    return blocking(
      'מספר המסמך מכיל ספרות בלבד. העתק אותו בדיוק כפי שהוא מודפס.',
      'The document number is digits only. Copy it exactly as it is printed.',
    );
  }
  if (!v.startsWith('89')) {
    return blocking(
      'מספר המסמך מתחיל תמיד בספרות 89. אם המספר שלפניך לא מתחיל כך, כנראה שזה לא מסמך ה-89.',
      'This number always begins with the digits 89. If the one in front of you does not, it is probably not your 89 document.',
    );
  }
  if (!FORM_89_NUMBER.test(v)) {
    /**
     * ⭐ The count he actually typed, said back to him. "Invalid number" makes a
     * person re-read the whole field looking for nothing; "that is 8 digits and
     * an 89 number has 9" tells him precisely where to look, and he finds the
     * digit he dropped in a second.
     */
    return blocking(
      `במסמך ה-89 יש תשע ספרות, וכאן יש ${v.length}. ודא שהעתקת את כל המספר.`,
      `An 89 number has nine digits, and this has ${v.length}. Check you copied the whole number.`,
    );
  }
  return null;
}

export function checkPassportNumber(value: string): FieldProblem | null {
  const v = stripPunctuation(value.trim()).toUpperCase();
  if (!v) return null;
  if (/[^A-Z0-9]/.test(v)) {
    return blocking(
      'מספר דרכון מורכב מאותיות באנגלית ומספרות בלבד.',
      'A passport number is made up of English letters and digits only.',
    );
  }
  if (v.length < 5 || v.length > 20) {
    return blocking(
      'זה לא נראה כמו מספר דרכון. העתק אותו בדיוק כפי שהוא מודפס בדרכון.',
      'That does not look like a passport number. Copy it exactly as printed in the passport.',
    );
  }
  if (!/\d/.test(v)) {
    // ⚠️ The heuristic. See PASSPORT_NUMBER above for what it is, and for what
    // it is not: a verified claim about every passport on earth.
    return blocking(
      'מספר דרכון כולל ספרות. ודא שהעתקת את המספר עצמו ולא פרט אחר מהעמוד.',
      'A passport number contains digits. Check you copied the number itself and not something else from the page.',
    );
  }
  return null;
}

export function checkLatinName(value: string): FieldProblem | null {
  const v = value.trim();
  if (!v) return null;
  if (!LATIN_NAME.test(v)) {
    return blocking(
      'כתוב את השם באותיות לטיניות, בדיוק כפי שהוא מודפס על המסמך. רק כך אפשר להשוות בין המסמכים.',
      'Write the name in Latin letters, exactly as printed on the document. That is the only way the documents can be compared.',
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────────────────────

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Whole months from `today` to a YYYY-MM. Negative once the month has passed. */
function monthsBetween(today: IsoDate, month: string): number {
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const [my, mm] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  return (my - ty) * 12 + (mm - tm);
}

/**
 * ⭐ THE CHECK THAT WAS MISSING ENTIRELY. `type="month"` carried no bounds, so a
 * passport expiring in the year 9999 was accepted in silence and every piece of
 * arithmetic downstream was quietly wrong. Found 31.8.
 *
 * ⚠️ ADVISORY, not blocking, and this is not a soft touch — it is F1 validation
 * 2: "המערכת מבקשת אישור במקום לחסום." A date far in the past is a REAL answer
 * (a long-expired passport is exactly the situation this product exists to
 * catch), and a person who mistypes a year is mis-remembering, not lying.
 * Refusing to help him is the behaviour this product replaces.
 *
 * The far bound is 20 years. Passports and visas run to ten at the very most,
 * so twenty is generous enough that anything past it is a typo rather than a
 * document.
 */
export function checkExpiryMonth(value: string, today: IsoDate): FieldProblem | null {
  const v = value.trim();
  if (!v) return null;

  if (!MONTH.test(v)) {
    return blocking(
      'בחר חודש ושנה.',
      'Choose a month and a year.',
    );
  }

  const months = monthsBetween(today, v);

  if (months > 240) {
    return advisory(
      'התאריך רחוק במיוחד — יותר מעשרים שנה מהיום. שווה לבדוק שהשנה הוקלדה נכון.',
      'That date is unusually far away, more than twenty years from now. Worth checking the year was typed correctly.',
    );
  }
  if (months < -600) {
    return advisory(
      'התאריך רחוק במיוחד לאחור. שווה לבדוק שהשנה הוקלדה נכון.',
      'That date is unusually far in the past. Worth checking the year was typed correctly.',
    );
  }
  return null;
}
