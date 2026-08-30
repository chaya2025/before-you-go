import { describe, it, expect } from 'vitest';
import { numbersAgree, namesAgree, resolveValidity, claimsValidButDateHasPassed } from './identity';

/**
 * ⚠️ The expensive direction here is a FALSE MISMATCH. Telling a person his
 * documents disagree sends him to book an appointment at משרד הרישוי to fix
 * nothing. So most of these tests are about what must NOT be flagged.
 */

describe('document numbers', () => {
  it('ignores how the same number was typed', () => {
    expect(numbersAgree('AB 123456', 'ab-123456')).toBe(true);
    expect(numbersAgree('  12345678  ', '12345678')).toBe(true);
  });

  it('catches a genuinely different passport — Chaya\'s own bug', () => {
    // Renewed passport mid-process. The 89 still carries the old number, and
    // per cc.passport_number_match the test is then recorded as a FAILURE.
    expect(numbersAgree('12345678', '87654321')).toBe(false);
  });

  it('a missing number is never a mismatch', () => {
    expect(numbersAgree(undefined, '12345678')).toBe('unknown');
    expect(numbersAgree('12345678', undefined)).toBe('unknown');
    expect(numbersAgree(undefined, undefined)).toBe('unknown');
    expect(numbersAgree('', '12345678')).toBe('unknown');
  });
});

describe('names across documents', () => {
  it('⭐ surname-first is the same person, not a problem to fix', () => {
    // Half the world prints the family name first. Sending this man to correct
    // his name would be wrong, and would cost him a trip.
    expect(namesAgree('SMITH JOHN', 'John Smith')).toBe(true);
  });

  it('accents and punctuation do not make a different person', () => {
    expect(namesAgree('José García', 'Jose Garcia')).toBe(true);
    expect(namesAgree("O'Brien Sean", 'Sean OBrien')).toBe(true);
    expect(namesAgree('ANNA-MARIA ROSSI', 'anna maria rossi')).toBe(true);
  });

  it('⭐ catches the transliteration split that no one can see coming', () => {
    // The failure Chaya could not hit, being fluent in both languages. One name
    // in Cyrillic, transliterated separately onto each document.
    expect(namesAgree('Olexandr Petrenko', 'Oleksandr Petrenko')).toBe(false);
    expect(namesAgree('Yosef Cohen', 'Yossef Cohen')).toBe(false);
  });

  it('a dropped middle name counts as a difference, because the desk sees one', () => {
    expect(namesAgree('John Michael Smith', 'John Smith')).toBe(false);
  });

  it('a married name against a maiden name is flagged', () => {
    expect(namesAgree('Maria Rossi', 'Maria Bianchi')).toBe(false);
  });

  it('a missing name is never a mismatch', () => {
    expect(namesAgree(undefined, 'John Smith')).toBe('unknown');
    expect(namesAgree('John Smith', undefined)).toBe('unknown');
    // A name with no Latin letters at all leaves nothing to compare.
    expect(namesAgree('יוסף כהן', 'Yosef Cohen')).toBe('unknown');
  });
});

describe('validity, from a self-report and an expiry month', () => {
  it('1. his own NO is never overruled by a date in the future', () => {
    expect(resolveValidity(false, 10)).toBe(false);
    expect(resolveValidity(false, 'unknown')).toBe(false);
  });

  it('2. a date that has passed decides, when he did not claim otherwise', () => {
    expect(resolveValidity('unknown', -6)).toBe(false);
  });

  it('3. ⭐ "valid" plus an expiry that has passed is answered with unknown', () => {
    expect(resolveValidity(true, -6)).toBe('unknown');
    expect(claimsValidButDateHasPassed(true, -6)).toBe(true);
    expect(claimsValidButDateHasPassed('unknown', -6)).toBe(false);
  });

  it('4. in the expiry month itself it defers to him, because a month is not a day', () => {
    expect(resolveValidity(true, 0)).toBe(true);
    expect(resolveValidity('unknown', 0)).toBe('unknown');
  });

  it('a future date settles a document he was unsure about', () => {
    expect(resolveValidity('unknown', 10)).toBe(true);
  });

  it('⚠️ a missing date can never make a document expired', () => {
    expect(resolveValidity('unknown', 'unknown')).toBe('unknown');
    expect(resolveValidity(true, 'unknown')).toBe(true);
  });
});
