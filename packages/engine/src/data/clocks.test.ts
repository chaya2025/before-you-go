import { describe, it, expect } from 'vitest';
import {
  ALL_CLOCKS,
  ALL_CONTINUOUS_CONDITIONS,
  ALL_DOCUMENTS,
  ALL_STEPS,
  documentById,
} from './index';

const clock = (id: string) => {
  const found = ALL_CLOCKS.find((c) => c.id === id);
  if (!found) throw new Error(`No clock "${id}"`);
  return found;
};

describe('⭐ the two clocks people confuse, and the confusion that costs them years', () => {
  const driving = () => clock('clock.foreign_driving');
  const converting = () => clock('clock.conversion_window');

  it('they are two separate clocks, not one', () => {
    expect(driving().id).not.toBe(converting().id);
    expect(driving().duration_days).toBe(365);
    expect(converting().duration_days).toBe(1826);
  });

  it('⚠️ they start on different dates — entry for driving, category anchor for converting', () => {
    // An עולה may drive for a year from ENTRY while his conversion window runs
    // five years from עלייה. Same person, two clocks, two starting dates.
    expect(driving().anchor).toBe('entry_to_israel');
    expect(converting().anchor).toBe('category_anchor');
  });

  it('⭐ the one-year expiry says you may still convert — this is the whole point', () => {
    // גיליון 13 principle 1: "זו נקודת הבלבול שגורמת לאנשים לוותר שנים לפני שצריך."
    expect(driving().on_expiry.he).toContain('עדיין אפשר להמיר');
    expect(driving().on_expiry.en.toLowerCase()).toContain('still convert');
  });

  it('the five-year expiry is not a dead end either — it routes to the from-zero track', () => {
    expect(converting().on_expiry.he).toContain('מאפס');
  });

  it('warns 60 days ahead, the number the נוהל itself recommends', () => {
    expect(driving().warn_before_days).toBe(60);
  });
});

describe('⭐ the accompaniment clock — the strongest finding in the research', () => {
  const accompaniment = () => clock('clock.accompaniment');

  it('is anchored at licence ISSUANCE, not at passing the test', () => {
    // For a citizen the permit arrives online in 72 hours, so the two dates
    // coincide. Without a teudat zehut the gap can be months, and every day of
    // it is pushed onto the END of the accompaniment period. Identical rule,
    // completely different outcome.
    expect(accompaniment().anchor).toBe('license_issued');
    expect(accompaniment().anchor).not.toBe('test_passed');
  });

  it('applies under 24, and runs six months', () => {
    expect(accompaniment().applies_when).toEqual({ field: 'age_years', op: 'lt', value: 24 });
    expect(accompaniment().duration_days).toBe(182);
  });

  it('rests on the state\'s own wording, not only on one person\'s memory', () => {
    const official = accompaniment().evidence.find((e) => e.certainty === 'verified');
    expect(official?.quote).toContain('מיום הוצאת רישיון הנהיגה');
  });
});

describe('the 48-hour window is the shortest thing in the system', () => {
  it('nothing else comes close', () => {
    const shortest = [...ALL_CLOCKS].sort((a, b) => a.duration_days - b.duration_days)[0]!;
    expect(shortest.id).toBe('clock.duplicate_delivery_choice');
    expect(shortest.duration_days).toBe(2);
  });

  it('is a choice of delivery method, and the step lists the options', () => {
    // Principle 21: state the rule and the action. What happens if he misses it
    // is not documented anywhere, so the copy does not speculate about it.
    const step = ALL_STEPS.find((s) => s.id === 'duplicate.in_person')!;
    expect(step.action.he).toContain('בחר איך לקבל את הרישיון');
    expect(step.action.he).toContain('איסוף עצמי');
    expect(step.action.he).toContain('שליח עד הבית');
    // ⭐ And the online channel offers the same delivery choice, because the
    // choice is made at fastdl either way. Only the request differs.
    const online = ALL_STEPS.find((s) => s.id === 'duplicate.online')!;
    expect(online.action.he).toContain('איסוף עצמי');
    expect(online.channel).toBe('online');
    expect(online.requires_appointment).toBe(false);
    expect(clock('clock.duplicate_delivery_choice').on_expiry.he).toContain('לא ניתן לבחור');
  });
});

describe('every clock is coherent', () => {
  it('warns before it expires, never after', () => {
    for (const c of ALL_CLOCKS) {
      expect(c.warn_before_days, c.id).toBeLessThan(c.duration_days);
    }
  });

  it('says what actually happens when it runs out', () => {
    for (const c of ALL_CLOCKS) {
      expect(c.on_expiry.he.length, c.id).toBeGreaterThan(0);
      expect(c.evidence.length, c.id).toBeGreaterThan(0);
    }
  });

  it('ids are unique', () => {
    expect(new Set(ALL_CLOCKS.map((c) => c.id)).size).toBe(ALL_CLOCKS.length);
  });
});

describe('⭐ continuous conditions — a completed step can be voided silently', () => {
  const cc = (id: string) => {
    const found = ALL_CONTINUOUS_CONDITIONS.find((c) => c.id === id);
    if (!found) throw new Error(`No continuous condition "${id}"`);
    return found;
  };

  it('every step named in check_before actually exists', () => {
    const ids = new Set(ALL_STEPS.map((s) => s.id));
    for (const condition of ALL_CONTINUOUS_CONDITIONS) {
      for (const stepId of condition.check_before) {
        expect(ids.has(stepId), `${condition.id} checks before "${stepId}", which does not exist`).toBe(true);
      }
    }
  });

  it('every one of them offers a remedy, not just the bad news', () => {
    for (const c of ALL_CONTINUOUS_CONDITIONS) {
      expect(c.remedy.he.length, c.id).toBeGreaterThan(0);
      expect(c.consequence_if_invalid.he.length, c.id).toBeGreaterThan(0);
    }
  });

  it('the visa is re-checked before EVERY physical visit, not once at the start', () => {
    const visa = cc('cc.visa_valid');
    expect(visa.check_before.length).toBeGreaterThan(3);
    expect(visa.check_before).toContain('fz.test');
    expect(visa.check_before).toContain('cv.attend');
  });

  it('the passport-number trap names the real cost: a recorded failure, not a turned-away visit', () => {
    const match = cc('cc.passport_number_match');
    expect(match.consequence_if_invalid.he).toContain('נרשם ככישלון');
    // And it tells him the appeal has a price of its own.
    expect(match.consequence_if_invalid.he).toContain('ערעור');
  });

  it('the passport remedy corrects the common misunderstanding about the 89 number', () => {
    // You do not get a new number. Only the link to the passport is updated.
    expect(cc('cc.passport_number_match').remedy.he).toContain('קבוע ואינו משתנה');
  });

  it('the address condition hands over the one answer that works without an address', () => {
    expect(cc('cc.address_registered').remedy.he).toContain('איסוף עצמי');
  });
});

describe('documents', () => {
  it('⭐ every document a step asks for actually exists', () => {
    for (const step of ALL_STEPS) {
      for (const docId of step.requires_documents) {
        expect(documentById(docId), `${step.id} requires "${docId}", which is not defined`).toBeDefined();
      }
    }
  });

  it('ids are unique and everything is sourced', () => {
    expect(new Set(ALL_DOCUMENTS.map((d) => d.id)).size).toBe(ALL_DOCUMENTS.length);
    for (const d of ALL_DOCUMENTS) expect(d.evidence.length, d.id).toBeGreaterThan(0);
  });

  it('⭐ the רקורד is the one document you can start remotely, today', () => {
    const record = documentById('doc.record')!;
    expect(record.accepts_email).toBe(true);
    expect(record.must_be_original).toBe(false);
    expect(record.notes!.he).toContain('מועד הוצאת הרישיון הקבוע');
  });

  it('the foreign licence document carries both traps: national only, and valid not merely held', () => {
    const licence = documentById('doc.foreign_license')!;
    expect(licence.notes!.he).toContain('IDP');
    expect(licence.notes!.he).toContain('בתוקף');
  });

  it('the entries-and-exits form is scoped to one category, against כל-זכות', () => {
    const form = documentById('doc.entry_exit_form')!;
    expect(form.applies_when).toEqual({
      field: 'nohal_category',
      op: 'eq',
      value: 'toshav_israel',
    });
  });

  it('the translation is worded as an authority, never as an obligation', () => {
    expect(documentById('doc.translation')!.notes!.he).toContain('רשאית');
    expect(documentById('doc.translation')!.notes!.he).toContain('לא חייבת');
  });

  it('the 89 document says where the number is NOT valid, which nobody tells you', () => {
    const form89 = documentById('doc.form_89')!;
    expect(form89.notes!.he).toContain('ביטוח לאומי');
  });
});
