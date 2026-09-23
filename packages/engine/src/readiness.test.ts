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

/** א/2 student, nothing to convert. The road where the 89 actually lives. */
const FROM_ZERO = {
  visa_type: 'a2',
  has_teudat_zehut: false,
  teudat_zehut_confirmed: true,
  visa_valid_now: true,
  foreign_license: { kind: 'none' },
  born: '2005-03',
};

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
  /**
   * Chaya's own case: renewed passport, 89 still carrying the old number.
   *
   * ⚠️ MOVED to the FROM-ZERO road on 23.9, and it should always have been
   * there. The 89 left the conversion road with `cv.doc_89` — the נוהל never
   * asks for one — and Chaya's own case is a from-zero case anyway: א/2, no
   * foreign licence, nothing to convert. The claim under test is untouched and
   * is still the most expensive warning in the product: a document he is
   * HOLDING that will be rejected is worse than one he knows he lacks.
   */
  const stale = readinessOf(
    p({
      visa_type: 'a2',
      has_teudat_zehut: false,
      teudat_zehut_confirmed: true,
      visa_valid_now: true,
      foreign_license: { kind: 'none' },
      born: '2005-03',
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
      expect(item.action!.he).not.toContain('להנפקה יש לפנות');
      expect(item.action!.en).not.toContain('To obtain it');
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

  /**
   * ⭐⭐ REGRESSION, 31.8, and the rule generalised beyond the 89.
   *
   * ⚠️ Found by reading a real Opus answer, not by any test. A man who answered
   * that he HAS his רקורד was told, as the first thing to do, to go and obtain
   * his רקורד — while the same result granted him the test exemption, which he
   * can only have BECAUSE he has it. Two contradictory beliefs about one
   * document, exactly the shape of the 30.8 obtain-and-update bug.
   *
   * Chaya's rule was never about the 89. It is about documents: a step that
   * exists to obtain one is done when the document is held.
   */
  it('⭐ saying you hold the רקורד removes the step that obtains it', () => {
    const converting = {
      visa_type: 'b1',
      has_teudat_zehut: false,
      teudat_zehut_confirmed: true,
      foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 7, held_class: 'B', language: 'en' },
      requested_class: 'B',
      entered_israel: '2024-01',
    };
    /**
     * ⚠️ CHANGED 23.9. It used to be marked 'done'; now it is not on his road
     * at all. Chaya: "only mention it as a step if he doesn't have one, and as
     * optional — and to bring it to the visit if he has it."
     *
     * The step is the ERRAND of obtaining one, and a man holding it has no
     * errand. What he still needs — bring it to the visit — is the DOCUMENT,
     * which is exactly where the נוהל puts it: פרק "מסמכים נדרשים".
     *
     * The rule underneath is the same one as 30.8 and it still holds: never
     * tell a man to obtain a document he is holding.
     */
    const holdsIt = evaluate(p({ ...converting, has_record_document: 'yes' }), TODAY);
    const record = holdsIt.roadmap.find((s) => s.step.id === 'cv.record');

    expect(record).toBeUndefined();
    // ⭐ And the DOCUMENT is still his, ready to bring. Removing the errand
    // must never remove the thing he carries to the counter.
    expect(bucketOf(holdsIt.readiness!, 'doc.record')).toBe('ready');
    // ⚠️ And it must not be what he is told to do first.
    expect(holdsIt.readiness!.first_action?.step_id).not.toBe('cv.record');

    // ⚠️ The engine may not believe two things at once: it granted the
    // exemption BECAUSE he has this, so it cannot also demand he obtain it.
    expect(holdsIt.diagnosis.exemption).toBe('exempt');
  });

  it('⚠️ but not having it, or not being asked, leaves the step standing', () => {
    const converting = {
      visa_type: 'b1',
      has_teudat_zehut: false,
      teudat_zehut_confirmed: true,
      foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 7, held_class: 'B', language: 'en' },
      requested_class: 'B',
      entered_israel: '2024-01',
    };
    for (const answer of ['no', 'in_progress', 'unknown']) {
      const r = evaluate(p({ ...converting, has_record_document: answer }), TODAY);
      expect(r.roadmap.find((s) => s.step.id === 'cv.record')?.state).not.toBe('done');
    }
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
    /**
     * ⚠️ The fixture now ANSWERS the record question, and that is the point.
     * Since 23.9 the step exists only for a man who has said he does not have
     * one — so that is who this rule is about. Unanswered, the first action is
     * the online form, which is correct: we do not send someone chasing a
     * foreign document before knowing whether he wants the exemption at all.
     */
    const r = readinessOf(p({ ...CONVERTER, has_record_document: 'no' }));
    expect(r.first_action!.step_id).toBe('cv.record');
    expect(r.first_action!.why.en).toContain('takes time');
  });

  it('⭐⭐ is never a step he has told us he cannot do', () => {
    /**
     * Found on the rendered page, 23.9: a man who answered "my country does not
     * issue a רקורד" was told the first thing to do was obtain one, directly
     * above the panel explaining that he cannot and need not. The step is still
     * on his road — it is where the explanation lives — but it must not be
     * promoted as his next action.
     */
    const r = readinessOf(
      p({ ...CONVERTER, has_record_document: 'origin_country_does_not_issue' }),
    );
    expect(r.first_action?.step_id).not.toBe('cv.record');
    // And he is not left with nothing: the road still has a real next thing.
    expect(r.first_action).not.toBeNull();
  });

  it('⭐ and an unanswered רקורד does not freeze the rest of the road', () => {
    // An OFFER cannot gate the queue. Before 23.9 an uncertain record at
    // position 1 made first_action null and every other step 'later'.
    const r = readinessOf(p(CONVERTER));
    expect(r.first_action).not.toBeNull();
    expect(r.first_action!.step_id).toBe('cv.online_form');
  });

  /** A broken document comes before everything, including the long-lead work. */
  it('a repair outranks the long-lead step, and says so', () => {
    const r = readinessOf(p({ ...CONVERTER, visa_valid_now: false }));
    expect(r.first_action!.step_id).toBe('fix.renew_visa');
    expect(r.first_action!.why.he).toContain('ראשון');
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

  /**
   * ⚠️ The 'gaps' case moved to the FROM-ZERO road on 23.9. A converter now has
   * nothing REQUIRED that he can be missing outright: the 89 left this road
   * with `cv.doc_89` (the נוהל never asks for one), and the רקורד is optional,
   * so it is deliberately excluded from the verdict. The ranking under test is
   * unchanged — mismatch beats gap beats unanswered.
   */
  it('ranks a mismatch above a gap, and a gap above an unanswered question', () => {
    expect(readinessOf(p({ ...CONVERTER, visa_valid_now: false })).verdict).toBe('mismatch');
    expect(readinessOf(p(FROM_ZERO)).verdict).toBe('gaps');
    expect(readinessOf(p(CONVERTER)).verdict).toBe('unknown');
  });

  it('⭐ an absent רקורד alone never reads as a gap — the נוהל offers it', () => {
    expect(readinessOf(p({ ...CONVERTER, has_record_document: 'no' })).verdict).not.toBe('gaps');
  });

  /**
   * ⭐ REGRESSION, 31.8. "2 מסמכים בידך לא יעבור בדלפק" — a plural subject with
   * a singular verb, because a count was being concatenated onto a fixed
   * sentence. Hebrew inflects the verb; the two numbers need two sentences.
   */
  it('⭐ agrees the verb with the number, in both languages', () => {
    // ⚠️ From-zero: the stale 89 is the single mismatch, and the 89 lives on
    // that road now. One mismatched document, which is what this tests.
    const one = readinessOf(
      p({
        ...FROM_ZERO,
        form_89_number: '891234567',
        form_89_passport_number: 'AB1234567',
        passport_number: 'CD7654321',
        passport_expires: '2029-04',
      }),
    );
    const many = readinessOf(p({ ...CONVERTER, visa_valid_now: false, passport_expires: '2029-04' }));

    expect(one.mismatched.length).toBe(1);
    expect(one.headline.he).toContain('מסמך אחד');
    expect(one.headline.he).toContain('לא יתקבל');
    expect(one.headline.en).toContain('One document');

    expect(many.mismatched.length).toBeGreaterThan(1);
    expect(many.headline.he).toContain('לא יתקבלו');
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
    expect(record.detail.he).toContain('המסלול נותר פתוח');
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
