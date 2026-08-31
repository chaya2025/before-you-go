import { describe, it, expect } from 'vitest';
import { Profile } from './profile';
import { evaluate } from './evaluate';
import type { Readiness, ReadinessItem } from './result';

/**
 * ============================================================================
 * THE READINESS REPORT
 * ============================================================================
 *
 * ⚠️ Four of these tests exist because the thing they check was WRONG in the
 * first version, and was found by reading real output rather than by any test.
 * They are marked ⭐ REGRESSION. That pattern is the whole reason `npm run
 * check` and `npm run audit` exist alongside the suite.
 */

const TODAY = '2026-08-31';
const p = (o: Record<string, unknown>) => Profile.parse(o);

/** Non-null assertion with a readable failure, used everywhere below. */
function readinessOf(profile: ReturnType<typeof p>): Readiness {
  const r = evaluate(profile, TODAY);
  if (!r.readiness) throw new Error('expected a readiness report, got null');
  return r.readiness;
}

const find = (items: ReadinessItem[], id: string) => items.find((i) => i.id === id);
const bucketOf = (r: Readiness, id: string): string | undefined =>
  [...r.ready, ...r.mismatched, ...r.missing, ...r.unconfirmed].find((i) => i.id === id)?.bucket;

// ─────────────────────────────────────────────────────────────────────────────

const CONVERTER = {
  visa_type: 'b1',
  has_teudat_zehut: false,
  teudat_zehut_confirmed: true,
  foreign_license: {
    kind: 'national',
    valid_now: true,
    years_held_permanent: 7,
    held_class: 'B',
    language: 'other',
  },
  requested_class: 'B',
  entered_israel: '2024-01',
  born: '1990-05',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('silence is never a "no"', () => {
  const r = readinessOf(p(CONVERTER));

  /**
   * ⭐ The reason the fourth bucket exists. He gave no passport expiry, so we
   * have no idea whether his passport is in order — and reporting that as
   * "missing" would tell a man carrying a perfectly good passport that he does
   * not have one. גיליון 13 principle 8, pointed at documents.
   */
  it('a document nobody asked about is unconfirmed, not missing', () => {
    expect(bucketOf(r, 'doc.passport')).toBe('unconfirmed');
    expect(find(r.missing, 'doc.passport')).toBeUndefined();
  });

  it('says so in words, rather than implying a problem', () => {
    expect(find(r.unconfirmed, 'doc.passport')!.detail.he).toContain('לא שאלנו');
    expect(find(r.unconfirmed, 'doc.passport')!.detail.en).toContain('did not ask');
  });

  /**
   * ⭐ REGRESSION, 31.8. cv.translation applied to EVERYONE converting while
   * doc.translation is scoped to a non-English licence, so a man who had not
   * yet said what language his licence is in was told outright that he was
   * MISSING a notarised translation. The step is now scoped like the document.
   */
  it('⭐ does not report a translation as missing when the language was never given', () => {
    const noLanguage = readinessOf(
      p({ ...CONVERTER, foreign_license: { ...CONVERTER.foreign_license, language: 'unknown' } }),
    );
    expect(find(noLanguage.missing, 'doc.translation')).toBeUndefined();
  });

  it('and drops it entirely for an English licence', () => {
    const english = readinessOf(
      p({ ...CONVERTER, foreign_license: { ...CONVERTER.foreign_license, language: 'en' } }),
    );
    expect(bucketOf(english, 'doc.translation')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('a document he holds that will not work', () => {
  /** Chaya's own case: renewed passport, 89 still carrying the old number. */
  const stale = readinessOf(
    p({
      ...CONVERTER,
      form_89_number: '891234567',
      form_89_passport_number: 'AB1234567',
      passport_number: 'CD7654321',
      passport_expires: '2029-04',
    }),
  );

  it('is mismatched, not missing — he has it', () => {
    expect(bucketOf(stale, 'doc.form_89')).toBe('mismatched');
    expect(find(stale.missing, 'doc.form_89')).toBeUndefined();
  });

  it('points at the step that repairs it, rather than restating the remedy', () => {
    expect(find(stale.mismatched, 'doc.form_89')!.resolved_by).toBe('fix.update_89');
  });

  it('a mismatch outranks everything else in the verdict', () => {
    expect(stale.verdict).toBe('mismatch');
  });

  /**
   * ⭐ REGRESSION, 31.8. Found by reading real output. doc.passport is defined
   * as "דרכון עם אשרת שהייה בתוקף" but only its passport half was checked, so
   * one screen listed the visa as broken and, four lines below, the
   * passport-with-a-valid-visa as in order. Two contradictory statements about
   * the same piece of paper — the same shape as the 30.8 obtain-and-update bug.
   */
  it('⭐ a lapsed visa also breaks the passport document that contains it', () => {
    const lapsed = readinessOf(p({ ...CONVERTER, visa_valid_now: false, passport_expires: '2029-04' }));
    expect(bucketOf(lapsed, 'doc.visa')).toBe('mismatched');
    expect(bucketOf(lapsed, 'doc.passport')).toBe('mismatched');
    expect(find(lapsed.ready, 'doc.passport')).toBeUndefined();
  });

  /**
   * ⭐ REGRESSION, 31.8. The generic fallback advice was "obtain it from your
   * home country", which reached a man whose passport was fine and whose visa
   * had lapsed. You never tell somebody to go and get a document he is holding.
   */
  it('⭐ never tells him to obtain a document he is already holding', () => {
    const lapsed = readinessOf(p({ ...CONVERTER, visa_valid_now: false, passport_expires: '2029-04' }));
    for (const item of lapsed.mismatched) {
      expect(item.action!.he).not.toContain('השג אותו');
      expect(item.action!.en).not.toContain('Obtain it');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('what his own road already says', () => {
  const fromZero = p({
    visa_type: 'a2',
    has_teudat_zehut: false,
    teudat_zehut_confirmed: true,
    visa_valid_now: true,
    foreign_license: { kind: 'none' },
    born: '2005-03',
  });

  it('a step still telling him to obtain a document means he does not have it', () => {
    const r = readinessOf(fromZero);
    expect(bucketOf(r, 'doc.form_89')).toBe('missing');
    expect(find(r.missing, 'doc.form_89')!.resolved_by).toBe('fz.doc_89');
  });

  /**
   * ⭐ Mid-process entry, arriving without anyone declaring it. He did this last
   * month; nothing else in the profile would ever tell us he holds the document.
   */
  it('ticking that step makes the document ready', () => {
    const r = readinessOf(p({ ...fromZero, completed_steps: ['fz.doc_89'] }));
    expect(bucketOf(r, 'doc.form_89')).toBe('ready');
  });

  /** Transcribing the number proves it just as well as ticking the box. */
  it('typing what is printed on it does the same', () => {
    const r = readinessOf(p({ ...fromZero, form_89_number: '891234567' }));
    expect(bucketOf(r, 'doc.form_89')).toBe('ready');
    expect(find(r.missing, 'doc.form_89')).toBeUndefined();
  });

  /**
   * ⚠️ The report must SHRINK as he progresses. A document he has already handed
   * over is history, and listing it would make finishing steps feel like taking
   * on more of them.
   */
  it('documents of finished steps drop out of the report', () => {
    const before = readinessOf(fromZero);
    const after = readinessOf(p({ ...fromZero, completed_steps: ['fz.doc_89', 'fz.photo_and_eye'] }));
    const needs = (r: Readiness) =>
      [...r.ready, ...r.mismatched, ...r.missing, ...r.unconfirmed].flatMap((i) => i.needed_for);
    expect(needs(before)).toContain('fz.photo_and_eye');
    expect(needs(after)).not.toContain('fz.photo_and_eye');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('the first thing to do', () => {
  it('is the first actionable step, and says why it is that one', () => {
    const r = readinessOf(p(CONVERTER));
    expect(r.first_action).not.toBeNull();
    expect(r.first_action!.why.he.length).toBeGreaterThan(0);
    expect(r.first_action!.why.en.length).toBeGreaterThan(0);
  });

  /**
   * ⭐ The ordering that looks wrong until it is explained. The רקורד sits at
   * the END of the road and must be BEGUN on day one, because a foreign
   * authority controls it. גיליון 13 principle 3.
   */
  it('sends a converter to the רקורד first, and explains the lead time', () => {
    const r = readinessOf(p(CONVERTER));
    expect(r.first_action!.step_id).toBe('cv.record');
    expect(r.first_action!.why.en).toContain('takes time');
  });

  /** A broken document comes before everything, including the long-lead work. */
  it('a repair outranks the long-lead step, and says so', () => {
    const r = readinessOf(p({ ...CONVERTER, visa_valid_now: false }));
    expect(r.first_action!.step_id).toBe('fix.renew_visa');
    expect(r.first_action!.why.he).toContain('קודם לכול');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('the verdict is about the documents, never about him', () => {
  it('a blocked person gets no readiness report at all', () => {
    const blocked = evaluate(
      p({ visa_type: 'section_2a5', foreign_license: { kind: 'none' }, has_teudat_zehut: false }),
      TODAY,
    );
    expect(blocked.blocked).not.toBeNull();
    /**
     * ⚠️ Not an empty report. Four empty lists would compute 'ready' and tell a
     * man who cannot proceed at all that he is good to go.
     */
    expect(blocked.readiness).toBeNull();
  });

  it('ranks a mismatch above a gap, and a gap above an unanswered question', () => {
    expect(readinessOf(p({ ...CONVERTER, visa_valid_now: false })).verdict).toBe('mismatch');
    expect(readinessOf(p(CONVERTER)).verdict).toBe('gaps');
  });

  /**
   * ⭐ REGRESSION, 31.8. "2 מסמכים בידך לא יעבור בדלפק" — a plural subject with
   * a singular verb, because a count was being concatenated onto a fixed
   * sentence. Hebrew inflects the verb; the two numbers need two sentences.
   */
  it('⭐ agrees the verb with the number, in both languages', () => {
    const one = readinessOf(
      p({
        ...CONVERTER,
        form_89_number: '891234567',
        form_89_passport_number: 'AB1234567',
        passport_number: 'CD7654321',
        passport_expires: '2029-04',
      }),
    );
    const many = readinessOf(p({ ...CONVERTER, visa_valid_now: false, passport_expires: '2029-04' }));

    expect(one.mismatched.length).toBe(1);
    expect(one.headline.he).toContain('מסמך אחד');
    expect(one.headline.he).toContain('לא יעבור');
    expect(one.headline.en).toContain('One document');

    expect(many.mismatched.length).toBeGreaterThan(1);
    expect(many.headline.he).toContain('לא יעברו');
    expect(many.headline.en).toContain('documents');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('honesty where the research stops', () => {
  /**
   * ⭐ Open question 16, and the biggest practical blocker in the conversion
   * route: the נוהל says nothing about a country that does not issue a רקורד.
   * "Go and get it" would be a confident answer to a question nobody has
   * answered. What IS known is that the רקורד only ever bought the exemption.
   */
  it('says it does not know, rather than inventing a procedure', () => {
    const r = readinessOf(p({ ...CONVERTER, has_record_document: 'origin_country_does_not_issue' }));
    const record = find(r.missing, 'doc.record')!;
    expect(record.detail.he).toContain('שאלה פתוחה');
    expect(record.detail.en).toContain('open question');
    // ⚠️ And it must not read as a rejection: the route is still fully his.
    expect(record.detail.he).toContain('המסלול פתוח בפניך');
  });

  it('treats a record already being chased as its own answer', () => {
    const r = readinessOf(p({ ...CONVERTER, has_record_document: 'in_progress' }));
    expect(find(r.missing, 'doc.record')!.detail.he).toContain('התחלת');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('rules that must hold for every item, whoever is asking', () => {
  const everyone = [
    p(CONVERTER),
    p({ ...CONVERTER, visa_valid_now: false }),
    p({ visa_type: 'a2', has_teudat_zehut: false, foreign_license: { kind: 'none' }, born: '2005-03' }),
    p({ visa_type: 'citizen', has_teudat_zehut: true, foreign_license: { kind: 'none' }, born: '2004-07' }),
    p({ ...CONVERTER, completed_steps: ['cv.record', 'cv.doc_89'] }),
  ].map(readinessOf);

  /** Hard rule 4. Nothing is shown to a user without saying where it came from. */
  it('every item cites a source', () => {
    for (const r of everyone) {
      for (const item of [...r.ready, ...r.mismatched, ...r.missing, ...r.unconfirmed]) {
        expect(item.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  /** ⚠️ "לעולם לא מסך דחייה יבש" — never bad news on its own. */
  it('every item that is not already fine carries an action', () => {
    for (const r of everyone) {
      for (const item of [...r.mismatched, ...r.missing, ...r.unconfirmed]) {
        expect(item.action?.he?.trim()).toBeTruthy();
        expect(item.action?.en?.trim()).toBeTruthy();
      }
    }
  });

  /** ⭐ And nothing to do about a document that is fine. */
  it('a ready item carries no chore', () => {
    for (const r of everyone) {
      for (const item of r.ready) expect(item.action).toBeUndefined();
    }
  });

  it('every item is wanted by at least one step still ahead of him', () => {
    for (const r of everyone) {
      for (const item of [...r.ready, ...r.mismatched, ...r.missing, ...r.unconfirmed]) {
        expect(item.needed_for.length).toBeGreaterThan(0);
      }
    }
  });

  it('a document appears in exactly one bucket', () => {
    for (const r of everyone) {
      const ids = [...r.ready, ...r.mismatched, ...r.missing, ...r.unconfirmed].map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  /** Progress is counted forwards, never as what is left. */
  it('counts steps done against the road he is actually on', () => {
    for (const r of everyone) {
      expect(r.steps_done).toBeLessThanOrEqual(r.steps_total);
      expect(r.steps_done).toBeGreaterThanOrEqual(0);
    }
  });
});
