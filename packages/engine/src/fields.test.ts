import { describe, it, expect } from 'vitest';
import { Profile } from './profile';
import { evaluate } from './evaluate';
import {
  checkForm89Number,
  checkPassportNumber,
  checkLatinName,
  checkExpiryMonth,
} from './fields';
import type { IsoDate } from './dates';

/**
 * ============================================================================
 * WHAT A PERSON IS ALLOWED TO TYPE
 * ============================================================================
 *
 * ⚠️ Chaya, 31.8: "a user can just input anything not relevant and it will go
 * through normally and give wrong result."
 *
 * ⭐ The tests are in two halves, and the second half is the point. The first
 * checks that the rules say yes and no in the right places. The second checks
 * what the rules are actually FOR: that garbage can no longer delete a real
 * step from a real person's roadmap.
 */

const TODAY = '2026-08-31' as IsoDate;
const ok = (problem: unknown) => expect(problem).toBeNull();
const blocked = (problem: { severity: string } | null) => expect(problem?.severity).toBe('blocking');

// ─────────────────────────────────────────────────────────────────────────────

describe('the 89 number', () => {
  it('accepts a real one', () => ok(checkForm89Number('891234567')));

  /** ⚠️ Empty is not wrong, it is unanswered. The whole screen is skippable. */
  it('says nothing about an empty box', () => {
    ok(checkForm89Number(''));
    ok(checkForm89Number('   '));
  });

  it('refuses letters', () => blocked(checkForm89Number('i dont know')));
  it('refuses a number that does not begin 89', () => blocked(checkForm89Number('12345678')));
  it('refuses a pasted wall of digits', () => blocked(checkForm89Number('89' + '1'.repeat(40))));

  /**
   * ⭐ Chaya counted the digits on her own 89 on 31.8, which closed a ⬜ that
   * had been open for a day. Eight digits is now a real answer to give him,
   * not a shrug — and the message says which number he is short of.
   */
  it('⭐ knows it is exactly nine digits, and says the count back to him', () => {
    ok(checkForm89Number('891234567'));
    const short = checkForm89Number('89123456');
    expect(short?.severity).toBe('blocking');
    expect(short?.message.en).toContain('nine digits');
    expect(short?.message.en).toContain('has 8');
  });

  /** Documents print numbers with spaces in them, and he is copying what he sees. */
  it('accepts the same number typed with spaces or a hyphen', () => {
    ok(checkForm89Number('89 123 4567'));
    ok(checkForm89Number('89-1234567'));
  });
});

describe('passport numbers', () => {
  it('accepts a real one', () => ok(checkPassportNumber('AB1234567')));

  /**
   * ⭐ REGRESSION. My first rule rejected this, and a test caught it within a
   * minute. identity.ts strips punctuation deliberately — "AB 123456" and
   * "ab-123456" are one passport, and splitting them would send somebody to the
   * licensing office to fix nothing.
   */
  it('⭐ accepts punctuation and lower case, exactly as identity.ts does', () => {
    ok(checkPassportNumber('ab-1234567'));
    ok(checkPassportNumber('AB 123 4567'));
  });

  it('refuses characters that are not letters or digits', () => {
    blocked(checkPassportNumber('AB123456!'));
    blocked(checkPassportNumber('אב1234567'));
  });

  it('refuses something far too short or too long', () => {
    blocked(checkPassportNumber('A1'));
    blocked(checkPassportNumber('A1'.repeat(30)));
  });

  /**
   * ⚠️ THE HEURISTIC, and the reason it exists. "i dont know" is letters and
   * spaces of an entirely plausible length. Without a digit rule it sails
   * through, disagrees with the real number on the other document, and puts
   * "go and update your 89" on his road — an appointment he does not need.
   *
   * ⬜ Not verified as a universal. Written down as a guess, in the one place
   * that would have to change.
   */
  it('⭐ refuses a phrase with no digits in it', () => {
    blocked(checkPassportNumber('i dont know'));
    blocked(checkPassportNumber('not sure'));
  });
});

describe('names', () => {
  it('accepts ordinary and awkward ones alike', () => {
    ok(checkLatinName('John Smith'));
    ok(checkLatinName("O'Brien"));
    ok(checkLatinName('ANNA-MARIA'));
    // ⚠️ José is a name, not a typo. Accents must survive.
    ok(checkLatinName('José García'));
  });

  /**
   * ⚠️ Not gatekeeping, and worth being clear about why. namesAgree reduces a
   * name to [a-z], so a name typed in Hebrew or Cyrillic becomes an empty
   * string and the comparison silently checks NOTHING. Saying "Latin letters,
   * as printed on the document" is honest; accepting it and quietly doing
   * nothing is not.
   */
  it('refuses a script the comparison cannot read', () => {
    blocked(checkLatinName('חיה רייכמן'));
    blocked(checkLatinName('Олександр'));
  });

  it('refuses digits and symbols', () => blocked(checkLatinName('John Smith 123')));
});

describe('expiry dates', () => {
  it('accepts a normal date, past or future', () => {
    ok(checkExpiryMonth('2029-04', TODAY));
    // ⚠️ A long-expired passport is a REAL answer, and exactly what this
    // product exists to catch. It must never be treated as a typo.
    ok(checkExpiryMonth('2019-01', TODAY));
  });

  /**
   * ⭐ The check that did not exist at all. `type="month"` carried no bounds,
   * so 9999-12 was accepted in silence and every piece of arithmetic
   * downstream was quietly wrong.
   */
  it('⭐ questions a date centuries away', () => {
    expect(checkExpiryMonth('9999-12', TODAY)?.severity).toBe('advisory');
  });

  /**
   * ⚠️ ADVISORY, never blocking. F1 validation 2 — "המערכת מבקשת אישור במקום
   * לחסום." A person who mistypes a year is mis-remembering, not lying, and
   * refusing to help him is the behaviour this product replaces.
   */
  it('⚠️ asks him to confirm rather than refusing him', () => {
    expect(checkExpiryMonth('9999-12', TODAY)?.severity).not.toBe('blocking');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// What the rules are actually for
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ garbage can no longer delete a step from a real roadmap', () => {
  const base = {
    visa_type: 'a2',
    has_teudat_zehut: false,
    teudat_zehut_confirmed: true,
    visa_valid_now: true,
    foreign_license: { kind: 'none' },
    born: '2005-03',
  };

  /**
   * ⭐⭐ THE BUG THIS WHOLE FILE EXISTS FOR, found by Chaya on 31.8.
   *
   * Transcribing an 89 is treated as proof that he holds one, which marks
   * "go to the licensing office and get your 89" as DONE. So typing a phrase
   * into that box used to delete the step — and the readiness report then
   * called the document "in your hands and in order".
   *
   * For a man with no teudat zehut the 89 IS his identity for the entire
   * licence process. He would have arrived at the desk without it. That is the
   * wasted trip this product exists to prevent, caused by a text box.
   */
  it('a phrase in the 89 box is refused outright, not believed', () => {
    const parsed = Profile.safeParse({ ...base, form_89_number: 'i dont know' });
    expect(parsed.success).toBe(false);
  });

  it('and the step it would have deleted is still standing', () => {
    // The same person, with the field simply left empty, as it now must be.
    const r = evaluate(Profile.parse(base), TODAY);
    const step = r.roadmap.find((s) => s.step.id === 'fz.doc_89');
    expect(step?.state).not.toBe('done');
    expect(r.readiness?.missing.map((i) => i.id)).toContain('doc.form_89');
  });

  /** ⚠️ The API is not protected by the form. It has to refuse this itself. */
  it('the schema refuses every field the form would refuse', () => {
    for (const bad of [
      { passport_number: 'i dont know' },
      { form_89_passport_number: 'no idea' },
      { passport_name_latin: 'חיה' },
      { form_89_number: 'abcdefg' },
    ]) {
      expect(Profile.safeParse({ ...base, ...bad }).success).toBe(false);
    }
  });

  /** ⚠️ And still accepts everything a real person would honestly type. */
  it('but accepts a real transcription, punctuation and all', () => {
    const parsed = Profile.safeParse({
      ...base,
      form_89_number: '89-1234567',
      form_89_passport_number: 'ab 1234567',
      passport_number: 'AB1234567',
      passport_name_latin: "José O'Brien-Smith",
    });
    expect(parsed.success).toBe(true);
  });
});

describe('an implausible date is questioned, not swallowed', () => {
  it('⭐ warns instead of silently doing wrong arithmetic', () => {
    const r = evaluate(
      Profile.parse({
        visa_type: 'a2',
        has_teudat_zehut: false,
        foreign_license: { kind: 'none' },
        passport_expires: '9999-12',
      }),
      TODAY,
    );
    expect(r.warnings.map((w) => w.field)).toContain('passport_expires');
  });

  /** ⚠️ A warning, so it never stops him getting his roadmap. */
  it('and still gives him his road', () => {
    const r = evaluate(
      Profile.parse({
        visa_type: 'a2',
        has_teudat_zehut: false,
        foreign_license: { kind: 'none' },
        passport_expires: '9999-12',
      }),
      TODAY,
    );
    expect(r.roadmap.length).toBeGreaterThan(0);
  });
});
