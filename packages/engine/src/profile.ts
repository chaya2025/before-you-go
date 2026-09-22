import { z } from 'zod';
import { FORM_89_NUMBER, PASSPORT_NUMBER, LATIN_NAME, stripPunctuation } from './fields';

/**
 * ============================================================================
 * PROFILE — everything we know about the person asking
 * ============================================================================
 *
 * Straight from גיליון F1_זרימה_אבחון. The question order there is deliberate
 * and it is preserved here, because the reasoning behind it is good:
 *
 *   ש1 status        — the strongest question. Moves four things at once
 *                      (category · window · grade ceiling · teudat zehut) and
 *                      catches the 2(א)(5) block without a separate, alienating
 *                      question. And the user KNOWS the answer: he carries the visa.
 *   ש2 foreign licence — the big structural fork. Conversion or from zero.
 *   ש3 entry date    — conversion only. Meaningless without a foreign licence.
 *   ש4 teudat zehut  — a CONFIRMATION, not a question. See below.
 *   ש5 licence years + requested grade — last, because it is the hardest to
 *                      recall, and if he is already blocked we did not bother him.
 *
 * Two rules from the research shape every field below.
 *
 *   F1 rule 6
 *     Only ש1 and ש2 are required. Everything else may be skipped with
 *     "I don't know" and the roadmap still gets built.
 *
 *   גיליון 13 principle 8
 *     "אל תציגי 'לא ידוע' כ'לא'." Never render unknown as no. So "unknown" is
 *     a real, explicit value here — not null, not false, not absence.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Unknown is an answer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Yes / no / genuinely does not know.
 *
 * The whole product exists because people are told "no" when the truth was
 * "nobody checked". Using `boolean | undefined` would let a missing answer
 * silently behave like false somewhere downstream. This cannot.
 */
export const Tristate = z.union([z.boolean(), z.literal('unknown')]);
export type Tristate = z.infer<typeof Tristate>;

/** A month, YYYY-MM. F1 ש3 asks for a month and year picker, not an exact day. */
const YearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

const YearMonthOrUnknown = z.union([YearMonth, z.literal('unknown')]);

// ─────────────────────────────────────────────────────────────────────────────
// ש1 — status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The visa codes, from גיליון 14 section ה, which settled them against
 * תקנות הכניסה לישראל תשל"ד-1974 (תקנה 5 for ב/x, תקנה 6 for א/x).
 *
 * ⚠️ That section supersedes גיליון 08, which still has ב/3 and ב/4 swapped.
 * The authoritative reading is ב/3 נכנס מסופק · ב/4 מתנדב.
 *
 * ⚠️ These codes carry NO eligibility logic here. Mapping a code to a
 * nohal_category is a rule with a source behind it, so it lives in the data
 * file with its citation, not hardcoded in a type. Same for whether a code
 * usually comes with a teudat zehut.
 */
export const VisaType = z.enum([
  'a1', // א/1 · עולה בכוח (אשרת עולה)
  'a2', // א/2 · תלמיד / סטודנט
  'a3', // א/3 · איש דת
  'a4', // א/4 · קרוב (נלווה)
  'a5', // א/5 · ארעי כללי — ⚠️ eligible. Not to be confused with 2(א)(5)
  'b1', // ב/1 · עובד זמני
  'b2', // ב/2 · תייר
  'b3', // ב/3 · נכנס מסופק
  'b4', // ב/4 · מתנדב
  'section_2a5', // 2(א)(5) · אישור שהייה — ⏳ blocked, pending בג"ץ
  'permanent_resident', // תושב קבע
  'citizen', // אזרח ישראלי
  'diplomat', // דיפלומט — 🔴 the נוהל is silent
  'unsure', // "לא בטוח / אין לי את המסמך מולי" — F1 step 7
]);
export type VisaType = z.infer<typeof VisaType>;

// ─────────────────────────────────────────────────────────────────────────────
// ש2, ש5 — the foreign licence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Israeli licence grades. The engine reasons in תקנה NUMBERS, not these names —
 * גיליון 06: "המנוע יכול לעבוד על מספרי התקנות ולא על שמות הדרגות."
 * The grade↔regulation mapping (176=A2 … 181=C1) is quoted data, so it lives in
 * the data file with its source.
 */
export const LicenseClass = z.enum([
  'A2', 'A1', 'A', '1', 'B', 'C1', // תקנות 176-181
  'C', 'D', 'D1', 'D2', 'D3', 'E', // תקנות 182-185 — closed to תושב מדינת חוץ
]);
export type LicenseClass = z.infer<typeof LicenseClass>;

/**
 * ⚠️ Case-INSENSITIVE on purpose, even though the form types in capitals.
 *
 * The form uppercases as he types, because that is how a passport prints it and
 * it makes the field legible. But identity.ts has always normalised case before
 * comparing, so a lowercase number was never a bug — and rejecting one at the
 * API would be strictness with no benefit, on a field where being turned away
 * costs a person his answer.
 */
const PassportNumber = z
  .string()
  .trim()
  .refine(
    (v) => PASSPORT_NUMBER.test(stripPunctuation(v)),
    'A passport number is letters and digits, and contains at least one digit',
  );

/**
 * ⚠️ Latin letters, and it has to be. namesAgree reduces a name to [a-z], so a
 * name typed in Hebrew or Cyrillic becomes an empty string and the comparison
 * silently does nothing at all. Refusing it is honest; accepting it and not
 * checking is not.
 */
const LatinName = z
  .string()
  .trim()
  .regex(LATIN_NAME, 'Write the name in Latin letters, as printed on the document');

export const ForeignLicense = z.object({
  /**
   * ⚠️ 'idp_only' is its own answer, not a kind of licence.
   * נוהל, "הערות" תבליט 1: "אין להציג רישיון נהיגה בין לאומי לצורך המרה
   * אלא רק רישיון לאומי." A very common and expensive mistake.
   */
  kind: z.enum(['national', 'idp_only', 'none', 'unknown']),

  /**
   * ⚠️ "בתוקף", not "קיים". An expired foreign licence cannot be converted
   * even after twenty years of holding it. F1 validation 6.
   */
  valid_now: Tristate.default('unknown'),

  /**
   * Years held as a PERMANENT national licence. The word "קבוע" is a condition,
   * not decoration — a learner or temporary licence does not count toward the
   * five years. גיליון 06 flagged that "קבוע" had been dropped from the quote.
   */
  years_held_permanent: z.union([z.number().min(0).max(80), z.literal('unknown')]).default('unknown'),

  /** The grade he holds abroad. The נוהל requires an equivalent Israeli grade. */
  held_class: z.union([LicenseClass, z.literal('unknown')]).default('unknown'),

  /**
   * Issuing country. ס' 3 לנוהל: where a treaty exists the application is
   * judged under the treaty instead. The country list is not in the נוהל and
   * we do not have it — open question 15.
   */
  country: z.string().min(1).optional(),

  /**
   * When it expires. Separate from `valid_now`, and resolved the same four-case
   * way the visa is — his own "no" wins, the date settles an unknown, and a
   * contradiction becomes 'unknown' rather than a guess.
   *
   * ⚠️ Not decoration. cc.foreign_license_valid names the real scenario: the
   * רקורד takes months, and the licence can expire while he waits for it. He
   * would then arrive holding a licence that is no longer convertible.
   */
  expires: YearMonthOrUnknown.default('unknown'),

  /**
   * The script the licence is printed in.
   *
   * ⚠️ Nothing asked this before, so nobody was told they need a notarised
   * translation until the desk told them. doc.translation already exists in the
   * data with its source; it simply had no way to know whether it applied.
   *
   * 'latin' is not the same as English. A Ukrainian licence in Latin script
   * still is not Hebrew or English, so it still needs translating. The engine
   * needs the honest answer, which is what LANGUAGE it is in.
   */
  language: z.enum(['he', 'en', 'other', 'unknown']).default('unknown'),

  /**
   * The holder's name as printed on the licence, in Latin letters.
   * Compared against the passport. See PASSPORT_NAME below for why.
   */
  name_latin: LatinName.optional(),
});
export type ForeignLicense = z.infer<typeof ForeignLicense>;

// ─────────────────────────────────────────────────────────────────────────────
// The profile
// ─────────────────────────────────────────────────────────────────────────────

export const Profile = z.object({
  /**
   * Seven languages, matching the ones the theory test is offered in.
   * Offered, not enforced — F1 step 1.
   */
  language: z.enum(['he', 'en', 'ar', 'ru', 'am', 'fr', 'es']).default('en'),

  // ── ש1 · required ────────────────────────────────────────────────────────
  visa_type: VisaType,

  /**
   * ⚠️ Eligibility is judged at the moment of submission, not at entry.
   * נוהל ס' 1(ג): "שהגיש את בקשתו בעת שהיה ברשותו רישיון ישיבה בישראל".
   * A visa that lapses mid-process voids it. This is re-checked before every
   * physical visit, not only at diagnosis — the continuous_condition insight.
   */
  visa_valid_now: Tristate.default('unknown'),

  /**
   * ⚠️ For a ב/2 tourist this is the real deadline, not the 5-year window.
   * A visit permit runs up to three months while the window runs five years,
   * so in practice the window is whatever is left on the visa.
   */
  visa_expires: YearMonthOrUnknown.default('unknown'),

  // ── ש2 · required ────────────────────────────────────────────────────────
  foreign_license: ForeignLicense,

  // ── ש3 · conversion only ─────────────────────────────────────────────────
  /**
   * ⚠️ Three different anchor events, one per category, and they are NOT
   * interchangeable — גיליון 13, `anchor_differs_by_status`:
   *   עולה חדש            → 5 years from עלייה
   *   תושב ישראל ששב      → 5 years from שיבה
   *   תושב מדינת חוץ      → 5 years from כניסה לישראל
   * Whichever applies, it also anchors the separate one-year driving clock.
   */
  entered_israel: YearMonthOrUnknown.default('unknown'),
  made_aliyah: YearMonthOrUnknown.default('unknown'),
  returned_to_israel: YearMonthOrUnknown.default('unknown'),

  /**
   * תושב ישראל ששב only. ס' 1(ב) requires six CONSECUTIVE months abroad after
   * receiving the national licence. Consecutive, not cumulative — F2 edge case 6.
   */
  lived_abroad_6_months_continuous: Tristate.default('unknown'),

  // ── ש4 · a confirmation, not a question ──────────────────────────────────
  /**
   * ⚠️ Never asked cold. F1 step 14 states it back:
   *   "לפי המעמד שבחרת, כנראה אין לך תעודת זהות ישראלית כחולה עם ספח. נכון?"
   *
   * Why: גיליון 11 שאלה 1 found that people do not know whether their 89 number
   * is a teudat zehut. Asking directly produces confident wrong answers, and a
   * wrong answer here misroutes the entire diagnosis. So the system infers from
   * the visa type, shows a physical description of both documents, and asks the
   * user to confirm or correct (F1 validation 4).
   *
   * ⚠️ And this decides the CHANNEL only, never eligibility. א/5 holds a teudat
   * zehut and is still capped at תקנות 176-181. Deriving one axis from the other
   * is the classic failure and it ends in rejection at the desk.
   */
  has_teudat_zehut: Tristate.default('unknown'),

  /** True once the user has actually seen the ש4 confirmation and answered it. */
  teudat_zehut_confirmed: z.boolean().default(false),

  // ── ש5 ───────────────────────────────────────────────────────────────────
  requested_class: z.union([LicenseClass, z.literal('unknown')]).default('unknown'),

  // ── ש6 ───────────────────────────────────────────────────────────────────
  /**
   * The רקורד: proof from the origin country of when the permanent licence was
   * issued. It buys exemption from BOTH מבחן שליטה and בדיקת ראייה.
   *
   * ⚠️ 'origin_country_does_not_issue' is its own answer. It is the biggest
   * practical blocker in the whole process and the נוהל says nothing about what
   * to do — open question 16. The system must not fold it into a plain "no".
   */
  has_record_document: z
    .enum(['yes', 'no', 'in_progress', 'origin_country_does_not_issue', 'unknown'])
    .default('unknown'),

  // ── the field that went missing twice ────────────────────────────────────
  /**
   * ⚠️ Absent from גיליון 01 AND גיליון 13 until גיליון 14 item 19 caught it.
   * Under 24 triggers six months of ליווי, and because the נהג חדש clock starts
   * at היתר issuance rather than at the test, every week of delay is pushed onto
   * the end of that period. Age multiplies the cost of every other delay.
   *
   * A birth month rather than an age, because the question is not "how old is he
   * now" but "how old will he be when the licence issues", months from now.
   */
  born: YearMonthOrUnknown.default('unknown'),

  // ── ש7 · the documents he is actually holding ────────────────────────────
  //
  // ⭐ the founder's design, 30.8: do not interrogate him about the RULES, ask him to
  // read what is printed in front of him and let the system find the problem.
  // He should never need to know that the 89 and the passport are linked. He
  // transcribes two numbers; the engine notices they disagree.
  //
  // ⚠️ PRIVACY (hard rule 1). These numbers are compared and discarded. They are
  // never stored, never logged, and — the part that is new — never echoed back
  // in any message. A mismatch says "the numbers do not match", never
  // "12345678 does not match", because that text ends up in a screenshot.
  //
  // At MVP these same fields become the output of a scan. Nothing here is
  // thrown away when OCR arrives; the typing is replaced, not the model.

  /**
   * The number on the 89 document. Begins 89, and never changes once issued.
   *
   * ⚠️ VALIDATED HERE, not only in the form. The founder, 31.8: "a user can just input
   * anything not relevant and it will go through normally and give wrong
   * result." The form is not a security boundary — anything it refuses must be
   * refused here too, or the same garbage reaches the engine through the API.
   *
   * ⭐ And this field above all, because of what it does downstream:
   * transcribing an 89 is treated as PROOF that he holds one, which marks the
   * "go and get your 89" step done. Typing `i dont know` used to delete a real
   * step from a real roadmap — the wasted trip this product exists to prevent,
   * caused by a text box.
   */
  /**
   * ⭐ "Do you have an 89 at all?" — asked BEFORE the three fields below, and
   * added 22.9 for the bug the founder found: an א/2 with no teudat zehut and no
   * licence was handed a box for his 89 number while step one of his own
   * roadmap told him to go to the licensing office and get one.
   *
   * ⚠️ This is the only thing that may turn `holds_form_89` into a `false`. A
   * blank number field must never do it — see the fact's own note. Unanswered
   * stays 'unknown', which is what skipping the screen means.
   *
   * ⚠️ Whether it is even asked is the ENGINE's call, not the form's:
   * Diagnosis.document_questions.form_89.confirm_possession.
   */
  holds_form_89: Tristate.default('unknown'),

  form_89_number: z
    .string()
    .trim()
    .refine(
      (v) => FORM_89_NUMBER.test(stripPunctuation(v)),
      'An 89 document number is digits only and begins with 89',
    )
    .optional(),

  /**
   * ⭐ THE FIELD THIS WHOLE FEATURE EXISTS FOR.
   *
   * The passport number PRINTED ON the 89. The 89 is issued against whichever
   * passport he showed that day, and from then on the pair is his identity for
   * the entire licence process.
   *
   * The founder renewed her passport mid-process. New number, no longer matching, and
   * she found out at her test — which per cc.passport_number_match is recorded
   * as a FAILURE, not as "did not attend". Fee paid, wait wasted, and appealing
   * blocks booking a new test until it concludes.
   *
   * ⚠️ Nobody renews a passport and thinks it touches their driving licence.
   * That is precisely why the system has to notice instead of asking him to.
   */
  form_89_passport_number: PassportNumber.optional(),

  /** The number in the passport he holds TODAY. Compared, never shown. */
  passport_number: PassportNumber.optional(),

  passport_expires: YearMonthOrUnknown.default('unknown'),

  /**
   * His name in Latin letters, exactly as the passport prints it.
   *
   * ⚠️ The failure the founder could never hit, being fluent in both languages and
   * born here. A name in Cyrillic, Amharic, Arabic or Chinese is transliterated
   * separately onto every document, and the spellings disagree: Olexandr /
   * Oleksandr / Alexander. Surname first on one, last on another. A married
   * name on the newer document and a maiden name on the older one.
   *
   * cc.english_name_match already requires the passport to match רשות
   * האוכלוסין. We cannot read their registry, so that edge stays a question we
   * ask. What we CAN do is compare the documents he is holding against each
   * other, which is a real check and was never being run.
   */
  passport_name_latin: LatinName.optional(),

  /** The name printed on the 89, if it carries one. Compared to the passport. */
  form_89_name_latin: LatinName.optional(),

  // ── mid-process entry (F0 feature 4.7) ───────────────────────────────────
  /**
   * Steps he has already done. The gap between what he has ticked and what his
   * route requires IS the readiness report.
   */
  completed_steps: z.array(z.string()).default([]),
});
export type Profile = z.infer<typeof Profile>;

// ─────────────────────────────────────────────────────────────────────────────
// Structural consistency — warns, never blocks
// ─────────────────────────────────────────────────────────────────────────────

export type ProfileWarning = {
  field: string;
  message_he: string;
  message_en: string;
};

/**
 * Cross-field sanity checks.
 *
 * ⚠️ These deliberately return warnings instead of failing the parse.
 * F1 validation 2: "המערכת מבקשת אישור במקום לחסום." A person whose answers
 * look contradictory is usually mis-remembering one date, not lying, and
 * refusing to help him is the behaviour this product exists to replace.
 */
export function checkProfile(profile: Profile, today: string): ProfileWarning[] {
  const warnings: ProfileWarning[] = [];
  const thisMonth = today.slice(0, 7);

  const notInFuture = (value: string | 'unknown', field: string, he: string, en: string) => {
    if (value !== 'unknown' && value > thisMonth) {
      warnings.push({ field, message_he: he, message_en: en });
    }
  };

  notInFuture(profile.entered_israel, 'entered_israel', 'תאריך הכניסה לישראל הוא בעתיד.', 'The entry date is in the future.');
  notInFuture(profile.made_aliyah, 'made_aliyah', 'תאריך העלייה הוא בעתיד.', 'The aliyah date is in the future.');
  notInFuture(profile.returned_to_israel, 'returned_to_israel', 'תאריך השיבה הוא בעתיד.', 'The return date is in the future.');
  notInFuture(profile.born, 'born', 'תאריך הלידה הוא בעתיד.', 'The birth date is in the future.');

  if (profile.born !== 'unknown' && profile.entered_israel !== 'unknown' && profile.entered_israel < profile.born) {
    warnings.push({
      field: 'entered_israel',
      message_he: 'תאריך הכניסה לישראל מוקדם מתאריך הלידה.',
      message_en: 'The entry date is before the birth date.',
    });
  }

  // F1 validation 2. Nobody holds a licence from before they were about sixteen.
  const years = profile.foreign_license.years_held_permanent;
  if (profile.born !== 'unknown' && years !== 'unknown') {
    const age = Number(thisMonth.slice(0, 4)) - Number(profile.born.slice(0, 4));
    if (years > age - 16) {
      warnings.push({
        field: 'foreign_license.years_held_permanent',
        message_he: 'ותק הרישיון גבוה מהצפוי לפי הגיל. אפשר לאשר או לתקן.',
        message_en: 'The licence seniority looks high for this age. Confirm or correct it.',
      });
    }
  }

  /**
   * ⚠️ He said the visa is valid, but the expiry month he gave has passed.
   * Usually a renewed visa with the old date still in the form. The engine
   * refuses to resolve this on its own (see deriveFacts case 3), so the person
   * is asked instead. F1 validation 2: ask for confirmation, never block.
   */
  if (profile.visa_valid_now === true && profile.visa_expires !== 'unknown' && profile.visa_expires < thisMonth) {
    warnings.push({
      field: 'visa_expires',
      message_he: 'אמרת שהאשרה בתוקף, אבל חודש התפוגה שמסרת כבר עבר. אם חידשת, עדכן את התאריך.',
      message_en: 'You said the visa is valid, but the expiry month you gave has already passed. If you renewed it, update the date.',
    });
  }

  /**
   * ⭐ THE DOCUMENT DATES, which nothing was checking at all until 31.8.
   *
   * ⚠️ `type="month"` in the form carried no bounds, so `9999-12` was accepted
   * in silence and every piece of arithmetic downstream was quietly wrong. This
   * catches the same thing on the API path, where there is no form at all.
   *
   * ⚠️ A WARNING, never a rejection. F1 validation 2 — "המערכת מבקשת אישור
   * במקום לחסום". A long-expired passport is a REAL answer and exactly the
   * situation this product exists to catch, so only the implausible far ends
   * are flagged, and even then he is asked rather than blocked.
   */
  const year = Number(thisMonth.slice(0, 4));
  const implausible = (value: string | 'unknown', field: string, label_he: string, label_en: string) => {
    if (value === 'unknown') return;
    const y = Number(value.slice(0, 4));
    if (y > year + 20 || y < year - 50) {
      warnings.push({
        field,
        message_he: `${label_he} רחוק במיוחד. שווה לבדוק שהשנה הוקלדה נכון.`,
        message_en: `${label_en} is unusually far off. Worth checking the year was typed correctly.`,
      });
    }
  };

  implausible(profile.passport_expires, 'passport_expires', 'תוקף הדרכון שמסרת', 'The passport expiry you gave');
  implausible(profile.visa_expires, 'visa_expires', 'תוקף האשרה שמסרת', 'The visa expiry you gave');
  implausible(
    profile.foreign_license.expires,
    'foreign_license.expires',
    'תוקף הרישיון הזר שמסרת',
    'The foreign licence expiry you gave',
  );

  return warnings;
}

/**
 * F1 rule 6: the roadmap is built once ש1 and ש2 are answered. Everything else
 * may stay "unknown" — those gaps become steps in the roadmap rather than a
 * locked form.
 */
export function canBuildRoadmap(profile: Profile): boolean {
  return profile.visa_type !== 'unsure' && profile.foreign_license.kind !== 'unknown';
}
