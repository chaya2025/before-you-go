import { describe, it, expect } from 'vitest';
import {
  CheckedSourcePart,
  weakestMark,
  explainCertainty,
  attributions,
  type SourcePart,
} from './certainty';

/**
 * These tests are the promise of the product, written down so it cannot quietly
 * stop being true. Each one comes from a real row in the research workbook.
 */

// A real 🟢 row: the grade ceiling, גיליון 02 / נוהל ס' 1(ג).
const gradeCeiling: SourcePart = {
  claim: 'תושב מדינת חוץ מוגבל לדרגות שבתקנות 176-181',
  certainty: 'verified',
  citation: 'נוהל אופן המרת רישיון נהיגה ממדינת חוץ, 15.2.2024, ס\' 1(ג)',
  quote:
    'ובלבד שרשות הרישוי לא תיתן לו רישיון נהיגה אלא לפי תקנות 176-181 (דרגות C1, B, A, A1, A2, 1)',
  url: 'https://www.gov.il/he/pages/1961',
  last_verified_at: '2026-08-21',
  variation_factors: [],
};

// A real 🔵 row: the walk-in for מספר 89, גיליון 04 row 7.
const walkIn89: SourcePart = {
  claim: 'להנפקה ראשונה של מספר 89 אין צורך בתור מראש',
  certainty: 'first_hand',
  last_verified_at: '2026-08-21',
  report_count: 1,
  generalizability: 'single_report',
  variation_factors: ['branch'],
};

describe('the data file refuses to load a broken claim', () => {
  it('rejects "verified" with no quote', () => {
    const result = CheckedSourcePart.safeParse({
      ...gradeCeiling,
      quote: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('rejects "verified" with no citation', () => {
    const result = CheckedSourcePart.safeParse({
      ...gradeCeiling,
      citation: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a first-hand claim with no report count, because the user never sees a count', () => {
    const result = CheckedSourcePart.safeParse({
      ...walkIn89,
      report_count: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('rejects "never checked" that carries a source, because a source means somebody checked', () => {
    const result = CheckedSourcePart.safeParse({
      claim: 'משהו',
      certainty: 'unchecked',
      citation: 'נוהל כלשהו',
      last_verified_at: '2026-08-21',
    });
    expect(result.success).toBe(false);
  });

  it('accepts the real rows from the workbook', () => {
    expect(CheckedSourcePart.safeParse(gradeCeiling).success).toBe(true);
    expect(CheckedSourcePart.safeParse(walkIn89).success).toBe(true);
  });
});

describe('כלל הודאות — the weakest part the system acts on sets the mark', () => {
  it('גיליון 05 row 12: 🟢 that the number exists + 🔵 that it applies to everyone = 🔵', () => {
    const numberExists: SourcePart = {
      claim: 'במשרד הרישוי יונפק מספר זיהוי המתחיל ב-89',
      certainty: 'verified',
      citation: 'דף השירות "הוצאת רישיון נהיגה", סעיף "הוצאת רישיון נהיגה לעובד זר"',
      quote: 'במשרד הרישוי יונפק מספר זיהוי פיקטיבי המתחיל בספרות 89',
      last_verified_at: '2026-08-21',
      variation_factors: [],
    };
    const appliesToAll: SourcePart = {
      claim: 'חל על כל מי שאין לו ת"ז, לא רק על "עובד זר"',
      certainty: 'first_hand',
      last_verified_at: '2026-08-21',
      report_count: 1,
      generalizability: 'single_report',
      variation_factors: [],
    };
    expect(weakestMark([numberExists, appliesToAll])).toBe('first_hand');
  });

  it('a claim resting only on official quotes stays 🟢', () => {
    expect(weakestMark([gradeCeiling])).toBe('verified');
  });

  it('"being contested" wins over everything, however well sourced the rest is', () => {
    const blocked2a5: SourcePart = {
      claim: 'בעלי אישור שהייה לפי 2(א)(5) אינם רשאים להוציא רישיון נהיגה',
      certainty: 'in_litigation',
      citation: 'דף השירות "הוצאת רישיון נהיגה", משרד התחבורה',
      quote:
        'בעלי אישור שהייה מכוח סעיף 2(א)(5) לחוק הכניסה לישראל אינם רשאים להוציא רישיון נהיגה',
      last_verified_at: '2026-08-21',
      legal_status: 'in_litigation',
      expected_resolution_at: '2026-10-10',
      variation_factors: [],
    };
    expect(weakestMark([gradeCeiling, blocked2a5])).toBe('in_litigation');
  });

  it('no evidence at all is ⬜ never checked, never a silent 🟢', () => {
    expect(weakestMark([])).toBe('unchecked');
  });
});

describe('principle 20 — a low mark changes the wording, never the visibility', () => {
  it('a first-hand claim still returns its evidence and its wording rule', () => {
    const explained = explainCertainty([walkIn89]);
    expect(explained.mark).toBe('first_hand');
    expect(explained.all_parts).toHaveLength(1);
  });

  it('says which parts set the mark, so "why?" is always answerable', () => {
    const explained = explainCertainty([gradeCeiling, walkIn89]);
    expect(explained.mark).toBe('first_hand');
    expect(explained.determined_by).toEqual([walkIn89]);
  });
});

describe('what the user actually sees — official first, reported second, both always', () => {
  const numberExists: SourcePart = {
    claim: 'במשרד הרישוי יונפק מספר זיהוי המתחיל ב-89',
    certainty: 'verified',
    citation: 'דף השירות "הוצאת רישיון נהיגה", סעיף "הוצאת רישיון נהיגה לעובד זר"',
    quote: 'במשרד הרישוי יונפק מספר זיהוי פיקטיבי המתחיל בספרות 89',
    last_verified_at: '2026-08-21',
    variation_factors: [],
  };

  it('keeps the official fact and the field report as separate voices, never merging or dropping either', () => {
    const shown = attributions([numberExists, walkIn89]);

    expect(shown.official).toHaveLength(1);
    expect(shown.reported).toHaveLength(1);

    // The state's fact is stated flatly — no hedge in front of it.
    expect(shown.official[0]!.lead_in.he).toBe('');
    expect(shown.official[0]!.citation).toContain('דף השירות');

    // The report is attributed, and useful.
    expect(shown.reported[0]!.lead_in.he).toBe('עפ״י דיווחים');
  });

  it('never leaks a report count into anything the user could see', () => {
    const shown = attributions([numberExists, walkIn89]);
    const rendered = JSON.stringify(shown);
    expect(rendered).not.toContain('report_count');
    expect(rendered).not.toContain('n=1');
    expect(rendered).not.toContain('single_report');
  });

  it('the row being 🔵 internally does not stamp a warning on the whole step', () => {
    const shown = attributions([numberExists, walkIn89]);
    // Internally the engine knows not to treat this as a hard rule...
    expect(shown.internal_mark).toBe('first_hand');
    // ...but the official half is still presented as the fact it is.
    expect(shown.official[0]!.mark).toBe('verified');
  });
});
