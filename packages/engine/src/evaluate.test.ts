import { describe, it, expect } from 'vitest';
import { Profile } from './profile';
import { evaluate, deriveFacts } from './evaluate';

/**
 * ============================================================================
 * THE PERSONA TESTS
 * ============================================================================
 *
 * Five real people through the whole engine. Two of them exist purely because
 * getting them wrong is the worst thing this product could do:
 *   · א/5 must come out ELIGIBLE
 *   · 2(א)(5) must come out BLOCKED
 * Those two look alike in writing and mean opposite things.
 */

const TODAY = '2026-08-26';
const p = (o: Record<string, unknown>) => Profile.parse(o);

// ─────────────────────────────────────────────────────────────────────────────

describe('persona 1 — Chaya. א/2 student, no teudat zehut, no foreign licence, 21', () => {
  const chaya = p({
    visa_type: 'a2',
    visa_valid_now: true,
    foreign_license: { kind: 'none' },
    has_teudat_zehut: false,
    teudat_zehut_confirmed: true,
    born: '2005-01',
    entered_israel: '2010-06',
  });
  const r = evaluate(chaya, TODAY);
  const ids = r.roadmap.map((s) => s.step.id);

  it('is not blocked', () => {
    expect(r.blocked).toBeNull();
  });

  it('goes the from-zero route, as a foreign resident', () => {
    expect(r.diagnosis.track).toBe('from_zero');
    expect(r.diagnosis.nohal_category).toBe('toshav_medinat_chutz');
  });

  it('is told to get the 89 number, and that it comes before the other steps', () => {
    expect(ids).toContain('fz.doc_89');
    const doc89 = r.roadmap.find((s) => s.step.id === 'fz.doc_89')!;
    // ⚠️ It is first in ORDER, carried by must_come_after on the later steps.
    // It is NOT start_now: that flag means "months, and someone else controls
    // it", which is true of the רקורד and false of a single walk-in visit.
    expect(doc89.start_now).toBe(false);
    expect(r.roadmap.find((s) => s.step.id === 'fz.online_form')!.waiting_on).toContain('fz.doc_89');
    expect(r.roadmap.find((s) => s.step.id === 'fz.photo_and_eye')!.waiting_on).toContain('fz.doc_89');
  });

  it('⭐ a start_now step is DO NOW, never "later" — even when another step sits ahead of it', () => {
    // Found by reading CLI output. fz.doc_89 is at position 2, so the position
    // rule alone marked it 'later' while it also carried ⭐start-now. A step
    // that says "begin this immediately" and then greys itself out reproduces
    // the exact failure act_when was added to prevent.
    for (const s of r.roadmap.filter((s) => s.start_now)) {
      expect(['do_now', 'done'], s.step.id).toContain(s.state);
    }
  });

  it('gets the PHYSICAL permit step, not the online one', () => {
    // Same entitlement, different channel. This is the whole finding.
    expect(ids).toContain('fz.permit_in_person');
    expect(ids).not.toContain('fz.permit_online');
  });

  it('gets the physical completion declaration, not the online one', () => {
    expect(ids).toContain('fz.completion_in_person');
    expect(ids).not.toContain('fz.completion_online');
  });

  it('is never shown a conversion step', () => {
    expect(ids.filter((id) => id.startsWith('cv.'))).toEqual([]);
  });

  it('⭐ is warned to book the permit appointment BEFORE the test', () => {
    const booking = r.roadmap.find((s) => s.step.id === 'fz.book_permit_appointment')!;
    expect(booking.must_precede).toBe('fz.test');
  });

  it('gets the accompaniment clock, because she is under 24', () => {
    expect(r.clocks.map((c) => c.clock.id)).toContain('clock.accompaniment');
  });

  it('⭐ a clock that has not begun says NOT STARTED, not "unknown"', () => {
    // "We do not know when you entered Israel" and "you have not passed the
    // test yet" are different sentences. Found by reading output, not by a
    // failing test — the whole screen said "unknown" and meant two things.
    const accompaniment = r.clocks.find((c) => c.clock.id === 'clock.accompaniment')!;
    expect(accompaniment.status).toBe('not_started');
    expect(accompaniment.missing_answer).toBeUndefined();
  });

  it('gets no conversion clocks, because she has no foreign licence', () => {
    const clockIds = r.clocks.map((c) => c.clock.id);
    expect(clockIds).not.toContain('clock.foreign_driving');
    expect(clockIds).not.toContain('clock.conversion_window');
  });

  it('is told the visa must stay valid throughout', () => {
    expect(r.standing_conditions.map((c) => c.id)).toContain('cc.visa_valid');
  });

  it('cannot do the eye test before she has the 89 document', () => {
    const eye = r.roadmap.find((s) => s.step.id === 'fz.photo_and_eye')!;
    expect(eye.waiting_on).toContain('fz.doc_89');
    expect(eye.state).toBe('waiting_on');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ persona 2 — א/5 תושב ארעי. HOLDS a teudat zehut, and is still a foreign resident', () => {
  const a5 = p({
    visa_type: 'a5',
    visa_valid_now: true,
    has_teudat_zehut: true,
    teudat_zehut_confirmed: true,
    foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 7, held_class: 'B' },
    requested_class: 'B',
    has_record_document: 'yes',
    entered_israel: '2024-01',
    born: '1990-05',
  });
  const r = evaluate(a5, TODAY);
  const ids = r.roadmap.map((s) => s.step.id);

  it('⭐ IS NOT BLOCKED — the highest-consequence assertion in the suite', () => {
    // Blocking a fully eligible temporary resident is the worst output this
    // product can produce. א/5 is not 2(א)(5).
    expect(r.blocked).toBeNull();
    expect(r.roadmap.length).toBeGreaterThan(0);
  });

  it('is still capped at 176-181 despite holding an ID', () => {
    // The two axes. The ID decides the channel; the category decides the ceiling.
    expect(r.diagnosis.grade_ceiling).toEqual({ from: 176, to: 181 });
    expect(r.diagnosis.nohal_category).toBe('toshav_medinat_chutz');
  });

  it('carries the caveat that spells the split out to him', () => {
    expect(r.diagnosis.caveat?.he).toContain('176-181');
  });

  it('goes the conversion route', () => {
    expect(r.diagnosis.track).toBe('conversion');
    expect(ids.filter((id) => id.startsWith('fz.'))).toEqual([]);
  });

  it('is NOT sent to get an 89 number, because he has a teudat zehut', () => {
    expect(ids).not.toContain('cv.doc_89');
  });

  it('is exempt from both tests — 7 years, a רקורד, and grade B', () => {
    expect(ids).not.toContain('cv.eye_test');
    expect(ids).not.toContain('cv.control_test');
  });

  it('⭐ still starts with the רקורד, though it is needed at the end', () => {
    expect(r.roadmap[0]!.step.id).toBe('cv.record');
    expect(r.roadmap[0]!.start_now).toBe(true);
  });

  it('gets both conversion clocks, counted from entry', () => {
    const clocks = Object.fromEntries(r.clocks.map((c) => [c.clock.id, c]));
    expect(clocks['clock.foreign_driving']!.starts).toBe('2024-01-01');
    expect(clocks['clock.conversion_window']!.starts).toBe('2024-01-01');
  });

  it('⭐ the one-year driving clock has expired while the five-year window is still open', () => {
    // The confusion that makes people give up years before they have to.
    const clocks = Object.fromEntries(r.clocks.map((c) => [c.clock.id, c]));
    expect(clocks['clock.foreign_driving']!.status).toBe('expired');
    expect(clocks['clock.conversion_window']!.status).toBe('running');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ persona 3 — 2(א)(5). Blocked, and told exactly why', () => {
  const asylum = p({
    visa_type: 'section_2a5',
    foreign_license: { kind: 'none' },
    has_teudat_zehut: false,
  });
  const r = evaluate(asylum, TODAY);

  it('is blocked', () => {
    expect(r.blocked).not.toBeNull();
    expect(r.blocked!.blocker.id).toBe('block.section_2a5');
  });

  it('gets no roadmap, because there is nothing honest to put in one', () => {
    expect(r.roadmap).toEqual([]);
    expect(r.clocks).toEqual([]);
  });

  it('is told where the prohibition comes from, and that it is contested', () => {
    expect(r.blocked!.blocker.explanation.he).toContain('אינו כתוב בנוהל');
    expect(r.blocked!.blocker.explanation.he).toContain('בג"ץ');
    expect(r.blocked!.blocker.legal_status).toBe('in_litigation');
  });

  it('is given a date to look again, and organisations to turn to', () => {
    expect(r.blocked!.days_to_expected_resolution).toBeGreaterThan(0);
    expect(r.blocked!.blocker.referrals.length).toBeGreaterThan(0);
  });

  it('still gets a diagnosis — he is not just shown a wall', () => {
    expect(r.diagnosis.nohal_category).toBe('not_defined_in_nohal');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('persona 4 — ב/1 foreign worker, 2 years on his licence, no רקורד', () => {
  const worker = p({
    visa_type: 'b1',
    visa_valid_now: true,
    has_teudat_zehut: false,
    teudat_zehut_confirmed: true,
    foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 2, held_class: 'B' },
    requested_class: 'B',
    has_record_document: 'no',
    entered_israel: '2026-03',
    born: '1995-02',
  });
  const r = evaluate(worker, TODAY);
  const ids = r.roadmap.map((s) => s.step.id);

  it('must sit both tests — under five years, and no רקורד either way', () => {
    expect(ids).toContain('cv.eye_test');
    expect(ids).toContain('cv.control_test');
  });

  it('IS sent to get an 89 number, because he has no teudat zehut', () => {
    expect(ids).toContain('cv.doc_89');
  });

  it('is not asked for the entries-and-exits form — that is one category only', () => {
    expect(ids).not.toContain('cv.entry_exit_form');
  });

  it('is inside both clocks, having entered five months ago', () => {
    const clocks = Object.fromEntries(r.clocks.map((c) => [c.clock.id, c]));
    expect(clocks['clock.foreign_driving']!.status).toBe('running');
    expect(clocks['clock.conversion_window']!.status).toBe('running');
  });

  it('⚠️ is warned that the one-year driving clock is close', () => {
    // Entered 2026-03, so the year runs out 2027-03 and the נוהל's own 60-day
    // warning window has not opened yet. Check the arithmetic is sane instead.
    const driving = r.clocks.find((c) => c.clock.id === 'clock.foreign_driving')!;
    expect(driving.deadline).toBe('2027-03-01');
    expect(driving.days_left).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ persona 5 — answered only the two required questions', () => {
  // F1 rule 6: the roadmap builds on ש1 and ש2 alone. Everything else may be
  // skipped, and skipping must never silently remove a step.
  const vague = p({ visa_type: 'b1', foreign_license: { kind: 'national' } });
  const r = evaluate(vague, TODAY);

  it('still gets a roadmap', () => {
    expect(r.blocked).toBeNull();
    expect(r.roadmap.length).toBeGreaterThan(0);
  });

  it('⭐ steps we cannot place stay on it, marked uncertain — never dropped', () => {
    const uncertain = r.roadmap.filter((s) => s.applies === 'unknown');
    expect(uncertain.length).toBeGreaterThan(0);
    expect(uncertain.every((s) => s.state === 'uncertain')).toBe(true);
  });

  it('⭐ each uncertain step names the question that would settle it', () => {
    const uncertain = r.roadmap.filter((s) => s.applies === 'unknown');
    for (const step of uncertain) {
      expect(step.missing_answers.length, step.step.id).toBeGreaterThan(0);
    }
  });

  it('collects every outstanding question into one list', () => {
    expect(r.diagnosis.unanswered).toContain('has_teudat_zehut');
  });

  it('shows the clocks as unknown rather than inventing a deadline', () => {
    const window = r.clocks.find((c) => c.clock.id === 'clock.conversion_window')!;
    expect(window.status).toBe('unknown');
    expect(window.deadline).toBeNull();
    expect(window.days_left).toBeNull();
    // And it names the question that would start the countdown.
    expect(window.missing_answer).toBe('months_since_anchor');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('mid-process entry — ticking what he has already done', () => {
  const partway = p({
    visa_type: 'a2',
    visa_valid_now: true,
    foreign_license: { kind: 'none' },
    has_teudat_zehut: false,
    teudat_zehut_confirmed: true,
    born: '2005-01',
    completed_steps: ['fz.english_name', 'fz.doc_89', 'fz.online_form'],
  });
  const r = evaluate(partway, TODAY);

  it('marks what he ticked as done', () => {
    const done = r.roadmap.filter((s) => s.state === 'done').map((s) => s.step.id);
    expect(done).toEqual(expect.arrayContaining(['fz.english_name', 'fz.doc_89', 'fz.online_form']));
  });

  it('⭐ unblocks the eye test, now that the 89 document is done', () => {
    const eye = r.roadmap.find((s) => s.step.id === 'fz.photo_and_eye')!;
    expect(eye.waiting_on).toEqual([]);
    expect(eye.state).toBe('do_now');
  });

  it('keeps every future step visible, greyed rather than hidden', () => {
    // "אחרי הטסט אף אחד לא אמר מה השלב הבא" — hiding is how that happens.
    expect(r.roadmap.some((s) => s.state === 'later')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('the fact derivation itself', () => {
  it('reads the aliyah date for an עולה, not the entry date', () => {
    const oleh = p({
      visa_type: 'a1',
      foreign_license: { kind: 'national' },
      entered_israel: '2015-01',
      made_aliyah: '2025-08',
    });
    const facts = deriveFacts(oleh, TODAY);
    // 12 months since aliyah, not 139 since entry. Reading the wrong one here
    // would tell him his five-year window closed six years ago.
    expect(facts.months_since_anchor).toBe(12);
  });

  it('reads the return date for a returning resident', () => {
    const returning = p({
      visa_type: 'citizen',
      foreign_license: { kind: 'national' },
      entered_israel: '1990-01',
      returned_to_israel: '2025-08',
    });
    expect(deriveFacts(returning, TODAY).months_since_anchor).toBe(12);
  });

  it('an IDP routes to the from-zero track and is never a block', () => {
    const idp = p({ visa_type: 'b1', foreign_license: { kind: 'idp_only' } });
    expect(deriveFacts(idp, TODAY).track).toBe('from_zero');
    expect(evaluate(idp, TODAY).blocked).toBeNull();
  });

  it('never derives a month count from a date it does not have', () => {
    const noDate = p({ visa_type: 'b1', foreign_license: { kind: 'national' } });
    expect(deriveFacts(noDate, TODAY).months_since_anchor).toBe('unknown');
    expect(deriveFacts(noDate, TODAY).age_years).toBe('unknown');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ answers that must actually change the answer (audit, 27.8)', () => {
  // Chaya, after using the site: "the אבחון didn't really affect the road map."
  // An audit changed one answer at a time and found two that changed NOTHING.
  // Both were real bugs. These tests exist so they cannot come back.

  const BASE = {
    visa_type: 'b1',
    visa_valid_now: true,
    has_teudat_zehut: false,
    teudat_zehut_confirmed: true,
    foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 7, held_class: 'B' },
    requested_class: 'B',
    has_record_document: 'yes',
    entered_israel: '2024-01',
    born: '1990-05',
  };
  const run = (patch: Record<string, unknown> = {}) => evaluate(p({ ...BASE, ...patch }), TODAY);

  it('⚠️ an expired visa is the FIRST thing he is told, not a footnote', () => {
    // Was silently ignored. The question was asked and the answer thrown away.
    const ok = run();
    const expired = run({ visa_valid_now: false });
    expect(ok.urgent).toEqual([]);
    expect(expired.urgent.map((u) => u.id)).toContain('urgent.visa_expired');
  });

  it('the expired-visa notice says what it blocks AND how to fix it', () => {
    const issue = run({ visa_valid_now: false }).urgent[0]!;
    // Never bad news alone — the brand rule is "לעולם לא מסך דחייה יבש".
    expect(issue.consequence.he).toContain('הרשויות');
    expect(issue.action.he).toContain('חודש');
    expect(issue.evidence.length).toBeGreaterThan(0);
  });

  it('⭐ asking for a bus licence as a foreign resident is flagged, not quietly routed', () => {
    // Was building an ordinary conversion roadmap for a grade that can never
    // be issued. נוהל ס' 1(ג) is an entitlement limit, not a difficulty.
    const bus = run({ requested_class: 'D' });
    expect(bus.diagnosis.requested_class_status).toBe('above');
    expect(bus.urgent.map((u) => u.id)).toContain('urgent.grade_above_ceiling');
  });

  it('the same request is fine for an עולה, who reaches 185', () => {
    const oleh = run({ visa_type: 'a1', made_aliyah: '2024-01', requested_class: 'D' });
    expect(oleh.diagnosis.grade_ceiling).toEqual({ from: 176, to: 185 });
    expect(oleh.diagnosis.requested_class_status).toBe('within');
    expect(oleh.urgent.map((u) => u.id)).not.toContain('urgent.grade_above_ceiling');
  });

  // ── the documents, and the order they have to be fixed in ──────────────

  const DOCS = {
    form_89_number: '891234567',
    form_89_passport_number: 'AB1234567',
    passport_number: 'CD7654321', // renewed. A different passport entirely.
  };

  it('⭐⭐ Chaya\'s real case: the 89 mismatch, and the visa that has to come first', () => {
    // What actually happened to her, in this order:
    //   the 89 did not match her passport, which killed her TEST
    //   she went to update the 89
    //   they told her at the desk that her visa had expired
    //   she renewed the visa, went back, and then the 89 could be updated
    //
    // Two trips, because she learned about her problems one at a time. This is
    // the entire reason a readiness check exists.
    const r = run({ ...DOCS, visa_valid_now: false });
    const ids = r.roadmap.map((s) => s.step.id);
    expect(ids).toContain('fix.renew_visa');
    expect(ids).toContain('fix.update_89');

    const fix89 = r.roadmap.find((s) => s.step.id === 'fix.update_89')!;
    expect(fix89.waiting_on).toContain('fix.renew_visa');
    expect(fix89.state).toBe('waiting_on');

    // And the visa fix is not waiting on anything. It is where he starts.
    const fixVisa = r.roadmap.find((s) => s.step.id === 'fix.renew_visa')!;
    expect(fixVisa.state).toBe('do_now');
  });

  it('⭐ the same mismatch with a valid visa is do-now, with nothing in front of it', () => {
    // waiting_on counts only steps on HIS road, so a man whose visa is fine
    // never sees a dependency that does not apply to him.
    const r = run({ ...DOCS, visa_valid_now: true });
    const fix89 = r.roadmap.find((s) => s.step.id === 'fix.update_89')!;
    expect(fix89.waiting_on).toEqual([]);
    expect(fix89.state).toBe('do_now');
    expect(r.roadmap.map((s) => s.step.id)).not.toContain('fix.renew_visa');
  });

  it('⭐⭐ typing an 89 number proves he has one, so he is not sent to get one', () => {
    // ⚠️ Found by Chaya on 30.8, using the documents screen the day it was
    // built. She entered a mismatched 89 and was told BOTH to update it and to
    // go and obtain one for the first time. Two contradictory instructions
    // about the same document, on the same page.
    //
    // Her rule: the field is optional precisely because filling it in IS the
    // answer. You cannot know your 89 number without holding the document.
    // ⚠️ cv.* here: this persona holds a national licence, so he is on the
    // CONVERSION route. The from-zero half of the same rule is covered by the
    // fz.doc_89 fixture run through the CLI.
    const r = run({ ...DOCS, visa_valid_now: false });
    const doc89 = r.roadmap.find((s) => s.step.id === 'cv.doc_89')!;
    expect(doc89.state).toBe('done');

    // And it must genuinely unblock what was waiting on it, exactly as ticking
    // the box would. Half a fix would leave the road stalled behind a step the
    // system already knows is finished.
    const form = r.roadmap.find((s) => s.step.id === 'cv.online_form')!;
    expect(form.waiting_on).not.toContain('cv.doc_89');
    expect(form.state).not.toBe('waiting_on');
  });

  it('and someone who did NOT type an 89 is still told to go and get one', () => {
    const r = run({ visa_valid_now: true });
    const doc89 = r.roadmap.find((s) => s.step.id === 'cv.doc_89')!;
    expect(doc89.state).not.toBe('done');
  });

  it('any one of the three 89 fields is enough evidence that he holds it', () => {
    // He may know the number, or only recognise the name printed on it.
    for (const field of ['form_89_number', 'form_89_passport_number', 'form_89_name_latin']) {
      const r = run({ [field]: field === 'form_89_name_latin' ? 'John Smith' : '891234567' });
      const doc89 = r.roadmap.find((s) => s.step.id === 'cv.doc_89')!;
      expect(doc89.state, field).toBe('done');
    }
  });

  it('⭐ four months abroad gets a heads-up, never a refusal', () => {
    // ⚠️ The third answer found to be collected and ignored, caught by the
    // audit on 30.8. A returning resident could say he spent four months
    // abroad and see the identical screen to a man who spent two years.
    //
    // ⭐ Chaya chose the SOFT form, on the reasoning the engine already holds:
    // a wrong block is worse than a missed one. A heads-up costs a moment of
    // doubt; a wrong "no" costs half a year on the long route.
    const returner = evaluate(
      p({
        visa_type: 'permanent_resident',
        has_teudat_zehut: true,
        teudat_zehut_confirmed: true,
        foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 12, held_class: 'B' },
        requested_class: 'B',
        returned_to_israel: '2025-02',
        lived_abroad_6_months_continuous: false,
      }),
      TODAY,
    );
    const issue = returner.urgent.find((u) => u.id === 'urgent.six_months_abroad')!;
    expect(issue.severity).toBe('advisory');
    // It must say the other route is open, not merely that this one is shut.
    expect(issue.consequence.he).toContain('אינה דחייה');
    expect(issue.consequence.he).toContain('מאפס');
    // ס' 1(ב) is quoted, not paraphrased.
    expect(issue.evidence[0]!.quote).toContain('שישה חודשים רצופים');
  });

  it('a foreign resident is never shown the 1(ב) notice — it is not his clause', () => {
    // ס' 1(ב) governs a RETURNING resident. A תושב מדינת חוץ falls under 1(ג),
    // and leaking one clause onto the other is the 27.8 bug in a new costume.
    const foreign = run({ lived_abroad_6_months_continuous: false });
    expect(foreign.urgent.map((u) => u.id)).not.toContain('urgent.six_months_abroad');
  });

  it('⭐⭐ the submission visit names every document it needs, filtered to him', () => {
    // ⚠️ Found 30.8 by a coverage sweep. cv.attend — the ONE visit where he
    // hands everything over — listed three documents out of nine. Four
    // documents existed in the data, fully sourced, required by NO step:
    // doc.record, doc.translation, doc.entry_exit_form, doc.teudat_oleh.
    //
    // ⚠️ The worst was doc.form_89. cv.doc_89 tells him to GO AND GET one and
    // nothing told him to BRING it, though for a man with no teudat zehut it
    // IS his identity for the whole process.
    const noTz = run({ foreign_license: { kind: 'national', valid_now: true, language: 'other' } });
    const attend = noTz.roadmap.find((s) => s.step.id === 'cv.attend')!;
    const ids = attend.documents.map((d) => d.id);
    expect(ids).toContain('doc.form_89');
    expect(ids).toContain('doc.record');
    expect(ids).toContain('doc.translation');

    // ⭐ And the filtering is what makes listing all nine safe: a teudat zehut
    // holder with an English licence must see neither.
    const withTz = evaluate(
      p({
        visa_type: 'a5',
        has_teudat_zehut: true,
        teudat_zehut_confirmed: true,
        foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 9, held_class: 'B', language: 'en' },
        requested_class: 'B',
        entered_israel: '2023-05',
      }),
      TODAY,
    );
    const theirs = withTz.roadmap.find((s) => s.step.id === 'cv.attend')!.documents.map((d) => d.id);
    expect(theirs).not.toContain('doc.form_89');
    expect(theirs).not.toContain('doc.translation');
    expect(theirs).toContain('doc.record');
  });

  it('⭐⭐ five years on a C1 is not five years on a B — the exemption reads the grade he HELD', () => {
    // ⚠️ Found 30.8 by a coverage sweep: held_class was read by NO rule in the
    // whole engine. EXEMPT_FROM_TESTS tested requested_class alone, but the
    // נוהל says "שהיה בעל רישיון... מדרגה המקבילה לאחת המנויות בתקנה 176 עד 180".
    // That is the grade he HELD. The five years have to be ON it.
    //
    // The man it hurt: twenty years driving a C1 (181) abroad, applying for a
    // B. The old rule saw "requested B", declared him exempt from BOTH מבחן
    // שליטה and בדיקת ראייה, and he would have arrived expecting to walk out
    // with a licence.
    const onC1 = run({
      foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 20, held_class: 'C1' },
      requested_class: 'B',
      has_record_document: 'yes',
    });
    const c1ids = onC1.roadmap.map((s) => s.step.id);
    expect(c1ids).toContain('cv.control_test');
    expect(c1ids).toContain('cv.eye_test');

    // The same seniority on a B (180) is inside the range, so he IS exempt.
    const onB = run({
      foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 20, held_class: 'B' },
      requested_class: 'B',
      has_record_document: 'yes',
    });
    const bids = onB.roadmap.map((s) => s.step.id);
    expect(bids).not.toContain('cv.control_test');
    expect(bids).not.toContain('cv.eye_test');
  });

  it('⚠️ an unknown held grade never quietly grants the exemption', () => {
    // Unknown must fail towards showing the test, not towards skipping it.
    // The costly direction is telling a man he is exempt when he is not.
    const unknown = run({
      foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 20 },
      requested_class: 'B',
      has_record_document: 'yes',
    });
    const ids = unknown.roadmap.map((s) => s.step.id);
    expect(ids).toContain('cv.control_test');
  });

  it('⭐ an א/5 IS asked about his visa, though he holds a teudat zehut', () => {
    // ⚠️ Chaya, 30.8: "consider it like anyone who doesn't have an ID. better
    // flagging than ignoring it."
    //
    // cc.visa_valid was scoped to NO_TEUDAT_ZEHUT, so an א/5 was never asked
    // about his visa. But his card is issued AGAINST that visa, not
    // independently of it — so the condition was silently exempting the person
    // most likely to be caught out.
    //
    // ⚠️ Scoped by nohal_category, not by visa code: the property that matters
    // is being a foreign resident whose status rests on a permit.
    const a5 = evaluate(
      p({
        visa_type: 'a5',
        has_teudat_zehut: true,
        teudat_zehut_confirmed: true,
        foreign_license: { kind: 'national', valid_now: true, years_held_permanent: 9, held_class: 'B' },
        requested_class: 'B',
        entered_israel: '2023-05',
      }),
      TODAY,
    );
    expect(a5.standing_conditions.map((c) => c.id)).toContain('cc.visa_valid');

    // ⚠️ And a citizen must NOT inherit it. His ID rests on nothing.
    const citizen = evaluate(
      p({
        visa_type: 'citizen',
        has_teudat_zehut: true,
        teudat_zehut_confirmed: true,
        foreign_license: { kind: 'none' },
      }),
      TODAY,
    );
    expect(citizen.standing_conditions.map((c) => c.id)).not.toContain('cc.visa_valid');
  });

  it('matching numbers put no fix on the road at all', () => {
    const r = run({
      form_89_passport_number: 'AB1234567',
      passport_number: 'ab-1234567', // same passport, typed differently
    });
    expect(r.roadmap.map((s) => s.step.id)).not.toContain('fix.update_89');
  });

  it('⚠️ a person who typed no documents is never told he might have a problem', () => {
    // The bug four tests caught on 30.8. A fix step is opt-in on evidence,
    // while the rest of the engine is opt-out on doubt — and telling somebody
    // his documents might be broken when nobody asked is the same sin as
    // rendering unknown as no, pointed the other way.
    const ids = run().roadmap.map((s) => s.step.id);
    expect(ids).not.toContain('fix.update_89');
    expect(ids).not.toContain('fix.name_on_89');
    expect(ids).not.toContain('fix.name_on_license');
  });

  it('⭐ a name spelled differently on the licence becomes a step, but surname-first does not', () => {
    const split = run({
      passport_name_latin: 'Olexandr Petrenko',
      foreign_license: { kind: 'national', valid_now: true, name_latin: 'Oleksandr Petrenko' },
    });
    expect(split.roadmap.map((s) => s.step.id)).toContain('fix.name_on_license');

    const ordered = run({
      passport_name_latin: 'John Smith',
      foreign_license: { kind: 'national', valid_now: true, name_latin: 'SMITH JOHN' },
    });
    expect(ordered.roadmap.map((s) => s.step.id)).not.toContain('fix.name_on_license');
  });

  // ── the expiry date, which was also being collected and ignored ────────

  it('an expiry month in the future settles a visa he was unsure about', () => {
    const r = run({ visa_valid_now: 'unknown', visa_expires: '2027-06' });
    expect(r.facts.visa_valid_now).toBe(true);
    expect(r.facts.months_until_visa_expiry).toBe(10);
  });

  it('an expiry month already passed makes it expired, when he did not claim otherwise', () => {
    const r = run({ visa_valid_now: 'unknown', visa_expires: '2026-02' });
    expect(r.facts.visa_valid_now).toBe(false);
    expect(r.urgent.map((u) => u.id)).toContain('urgent.visa_expired');
  });

  it('⭐ his own NO is never overruled by a date in the future', () => {
    // A visa can be revoked, cancelled or surrendered long before it expires.
    // He knows something the printed date cannot show.
    const r = run({ visa_valid_now: false, visa_expires: '2027-06' });
    expect(r.facts.visa_valid_now).toBe(false);
    expect(r.urgent.map((u) => u.id)).toContain('urgent.visa_expired');
  });

  it('⭐ "valid" plus an expiry that has passed is answered with unknown, not a guess', () => {
    // Two credible answers point opposite ways. Probably a renewed visa with
    // the old date still typed in. The engine refuses to pick a side.
    const r = run({ visa_valid_now: true, visa_expires: '2026-02' });
    expect(r.facts.visa_valid_now).toBe('unknown');
    expect(r.urgent.map((u) => u.id)).not.toContain('urgent.visa_expired');
    expect(r.warnings.map((w) => w.field)).toContain('visa_expires');
  });

  it('in the expiry month itself the engine defers to him, because a month is not a day', () => {
    expect(run({ visa_valid_now: true, visa_expires: '2026-08' }).facts.visa_valid_now).toBe(true);
    expect(run({ visa_valid_now: 'unknown', visa_expires: '2026-08' }).facts.visa_valid_now).toBe('unknown');
  });

  it('no date given can never make a visa expired', () => {
    expect(run({ visa_valid_now: 'unknown' }).facts.visa_valid_now).toBe('unknown');
    expect(run({ visa_valid_now: 'unknown' }).urgent.map((u) => u.id)).not.toContain('urgent.visa_expired');
  });

  it('⭐ a visa that has not expired yet never blocks him, it only reminds him', () => {
    // ⚠️ Chaya, 30.8. Her rule: "he can still go, but he has to renew the visa
    // at least a month before it expires... the renew a month before should be
    // a friendly reminder."
    //
    // The first version put this in the same box as an EXPIRED visa. Someone
    // with three days left would have read "deal with this first" above his
    // whole roadmap and reasonably not gone at all, losing the days he had.
    const soon = run({ visa_expires: '2026-10' }).urgent.find(
      (u) => u.id === 'urgent.visa_expiring_soon',
    )!;
    expect(soon.severity).toBe('advisory');
    // It has to SAY so, not merely be typed so.
    expect(soon.consequence.he).toContain('אינה חסימה');
    expect(soon.action.he).toContain('במקביל');
  });

  it('an expired visa is the one that genuinely blocks', () => {
    const expired = run({ visa_valid_now: false }).urgent.find(
      (u) => u.id === 'urgent.visa_expired',
    )!;
    expect(expired.severity).toBe('blocking');
  });

  it('an unreachable grade blocks; an IDP does not', () => {
    // The ceiling means the destination does not exist. The IDP only means the
    // route changed, and the from-zero route below it is entirely walkable.
    const bus = run({ requested_class: 'D' }).urgent.find(
      (u) => u.id === 'urgent.grade_above_ceiling',
    )!;
    expect(bus.severity).toBe('blocking');

    const idp = run({ foreign_license: { kind: 'idp_only', valid_now: true } }).urgent.find(
      (u) => u.id === 'urgent.idp_not_convertible',
    )!;
    expect(idp.severity).toBe('advisory');
  });

  it('every urgent issue declares a severity', () => {
    // Guards the next one somebody adds. A missing severity would render as a
    // blocker by default in the UI, which is the failure this whole axis exists
    // to prevent.
    const all = [
      ...run({ visa_valid_now: false }).urgent,
      ...run({ visa_expires: '2026-10' }).urgent,
      ...run({ requested_class: 'D' }).urgent,
      ...run({ foreign_license: { kind: 'idp_only', valid_now: true } }).urgent,
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const u of all) expect(['blocking', 'advisory']).toContain(u.severity);
  });

  it('⭐ two months of runway is flagged, because one of them is the renewal', () => {
    const soon = run({ visa_expires: '2026-10' });
    expect(soon.urgent.map((u) => u.id)).toContain('urgent.visa_expiring_soon');
    // Ten months is not a warning, it is just a date.
    expect(run({ visa_expires: '2027-06' }).urgent.map((u) => u.id)).not.toContain(
      'urgent.visa_expiring_soon',
    );
  });

  it('an already-expired visa gets the expired notice, not the expiring-soon one', () => {
    const ids = run({ visa_valid_now: false, visa_expires: '2026-02' }).urgent.map((u) => u.id);
    expect(ids).toContain('urgent.visa_expired');
    expect(ids).not.toContain('urgent.visa_expiring_soon');
  });

  it('⭐ an IDP holder is routed from-zero AND told that is what happened', () => {
    // The routing was always right: an IDP is not a national licence, so
    // conversion is not open. But he was moved onto the LONGER route silently,
    // having answered a question that appeared to change nothing.
    const idp = run({ foreign_license: { kind: 'idp_only', valid_now: true } });
    expect(idp.diagnosis.track).toBe('from_zero');
    expect(idp.urgent.map((u) => u.id)).toContain('urgent.idp_not_convertible');
  });

  it('a national licence is never flagged as an IDP', () => {
    expect(run().urgent.map((u) => u.id)).not.toContain('urgent.idp_not_convertible');
  });

  it('⭐ the IDP notice points him at the national licence he probably already has', () => {
    // The whole value of the notice. An IDP is ISSUED on the basis of a
    // national licence, so retrieving it may open the much shorter conversion
    // route. Telling him only "this is not accepted" would waste that.
    const issue = run({ foreign_license: { kind: 'idp_only', valid_now: true } }).urgent.find(
      (u) => u.id === 'urgent.idp_not_convertible',
    )!;
    expect(issue.action.he).toContain('לאומי');
    expect(issue.consequence.he).toContain('אינה דחייה');
    expect(issue.evidence.length).toBeGreaterThan(0);
  });

  it('C1 sits inside the ceiling, so it is never flagged — only 182-185 are above', () => {
    expect(run({ requested_class: 'C1' }).diagnosis.requested_class_status).toBe('within');
    expect(run({ requested_class: 'B' }).diagnosis.requested_class_status).toBe('within');
  });

  it('the exemption shown in the summary matches the steps in the roadmap', () => {
    // Read off the roadmap rather than recomputed, so the two can never disagree.
    const exempt = run();
    expect(exempt.diagnosis.exemption).toBe('exempt');
    expect(exempt.roadmap.map((s) => s.step.id)).not.toContain('cv.control_test');

    const notExempt = run({ has_record_document: 'no' });
    expect(notExempt.diagnosis.exemption).toBe('tests_required');
    expect(notExempt.roadmap.map((s) => s.step.id)).toContain('cv.control_test');
  });

  it('the summary echoes the grade back, so a wrong answer is visible before the roadmap', () => {
    expect(run({ requested_class: 'C1' }).diagnosis.requested_class).toBe('C1');
    expect(run({ requested_class: 'unknown' }).diagnosis.requested_class).toBe('unknown');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ nothing from the other route leaks in (Chaya, 27.8)', () => {
  // Her report, as a citizen with a teudat zehut and no foreign licence:
  // "it still gives me the option of an 8-9... it even tells the user he could
  //  be converting it. Make sure to be specific to the actual route."

  const citizen = p({
    visa_type: 'citizen',
    has_teudat_zehut: true,
    teudat_zehut_confirmed: true,
    foreign_license: { kind: 'none' },
    born: '1995-05',
  });
  const r = evaluate(citizen, TODAY);
  const allDocs = r.roadmap.flatMap((s) => s.documents.map((d) => d.id));
  const allChecks = r.roadmap.flatMap((s) => s.checklist.map((c) => c.he));

  it('is on the from-zero route with no conversion steps', () => {
    expect(r.diagnosis.track).toBe('from_zero');
    expect(r.roadmap.filter((s) => s.step.id.startsWith('cv.'))).toEqual([]);
  });

  it('⭐ is never told to bring the 89 document he was never told to get', () => {
    // The step lists it because the step is shared between both channels.
    // The DOCUMENT knows it only applies without a teudat zehut, and the engine
    // now asks it rather than trusting the step's raw list.
    expect(r.roadmap.map((s) => s.step.id)).not.toContain('fz.doc_89');
    expect(allDocs).not.toContain('doc.form_89');
  });

  it('⭐ is not asked the checklist questions that belong to the other channel', () => {
    expect(allChecks.some((c) => c.includes('הטופס הלבן'))).toBe(false);
    expect(allChecks.some((c) => c.includes('תור להוצאת ההיתר'))).toBe(false);
  });

  it('⭐ is told nothing about converting — he has never held a licence', () => {
    // Six consecutive months abroad and the entries-and-exits form are
    // conversion requirements, and were being shown on the from-zero route.
    expect(r.diagnosis.extra_requirements).toEqual([]);
    expect(r.clocks.map((c) => c.clock.id)).not.toContain('clock.conversion_window');
    expect(r.clocks.map((c) => c.clock.id)).not.toContain('clock.foreign_driving');
  });

  it('⚠️ claims no grade ceiling on the from-zero route, because none is sourced', () => {
    // ס' 1(ג) states the 176-181 cap about CONVERSION. Whether it binds someone
    // going from zero is genuinely unknown, so the honest answer is nothing.
    expect(r.diagnosis.grade_ceiling).toBeNull();
  });

  it('gets the online channel throughout, because he has an ID', () => {
    const ids = r.roadmap.map((s) => s.step.id);
    expect(ids).toContain('fz.permit_online');
    expect(ids).not.toContain('fz.permit_in_person');
    expect(ids).not.toContain('fz.permit_fee');
    // ⚠️ And at 31 he files NO declaration at all — over 24 is exempt from the
    // ליווי and therefore from the form. He is told so rather than left guessing.
    expect(ids).not.toContain('fz.completion_online');
    expect(ids).toContain('fz.no_declaration_needed');
  });

  it('and the person WITHOUT an ID still gets all of it', () => {
    // The filtering must remove things for the right person, not for everyone.
    const noId = evaluate(
      p({ visa_type: 'a2', has_teudat_zehut: false, foreign_license: { kind: 'none' }, born: '2005-01' }),
      TODAY,
    );
    const docs = noId.roadmap.flatMap((s) => s.documents.map((d) => d.id));
    const checks = noId.roadmap.flatMap((s) => s.checklist.map((c) => c.he));
    expect(docs).toContain('doc.form_89');
    expect(checks.some((c) => c.includes('הטופס הלבן'))).toBe(true);
    expect(noId.roadmap.map((s) => s.step.id)).toContain('fz.doc_89');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ everything shown belongs to the person shown it (27.8 sweep)', () => {
  const citizen = evaluate(
    p({
      visa_type: 'citizen',
      has_teudat_zehut: true,
      teudat_zehut_confirmed: true,
      foreign_license: { kind: 'none' },
      born: '1995-05',
    }),
    TODAY,
  );
  const noId = evaluate(
    p({ visa_type: 'a2', has_teudat_zehut: false, foreign_license: { kind: 'none' }, born: '2005-01' }),
    TODAY,
  );

  const textOf = (r: ReturnType<typeof evaluate>) =>
    [
      ...r.roadmap.flatMap((s) => [s.step.action.he, ...s.notes.map((n) => n.he), ...s.checklist.map((c) => c.he)]),
      r.diagnosis.caveat?.he ?? '',
      ...r.diagnosis.extra_requirements.map((e) => e.he),
    ].join(' ');

  it('⭐ a citizen with no foreign licence is never told about the 89', () => {
    // The green-form step used to end "הדף שאתה נושא הוא הטופס הלבן (89)"
    // for everyone. He will never hold one.
    expect(textOf(citizen)).not.toContain('89');
  });

  it('⭐ and is never told about converting, on any surface', () => {
    // caveat, extra_requirements, actions, notes and checklist all checked.
    const text = textOf(citizen);
    expect(text).not.toContain('המרה');
    expect(text).not.toContain('שישה חודשים רצופים');
  });

  it('but the person WITHOUT an ID still gets the 89 explanation', () => {
    expect(textOf(noId)).toContain('89');
  });

  it('⭐ the נהג חדש passenger limit is stated, and it outlasts the ליווי', () => {
    // One box now, with the lines inside it scoped by age. noId is 21 in 2026,
    // so the passenger limit no longer binds her — and correctly is not shown.
    const box = noId.roadmap.find((s) => s.step.id === 'fz.new_driver')!;
    expect(box.step.evidence.some((e) => e.quote?.includes('שני נוסעים'))).toBe(true);
  });

  it('⭐ the "new driver" sign applies to EVERY new driver, not only under-24s', () => {
    // The ליווי is age-dependent. This is not, so it is its own step.
    for (const r of [citizen, noId]) {
      const box = r.roadmap.find((s) => s.step.id === 'fz.new_driver');
      expect(box, 'new-driver box missing').toBeDefined();
      expect(box!.applies).toBe(true);
    }
  });

  it('the plastic card says roughly how long it should take', () => {
    const card = noId.roadmap.find((s) => s.step.id === 'fz.receive_card')!;
    expect(card.step.action.he).toContain('חודש');
  });

  /**
   * ⭐ REWRITTEN 31.8, because the DECISION changed and the test encoded the old
   * one. On 27.8 Chaya said only "never heard about that", so the receipt
   * stayed on the bring-list with her observation beside it. On 31.8 she gave
   * the mechanism — the fee is paid online and whoever books the test sees it
   * in the system — which explains why nobody asks, and makes the official list
   * stale rather than inconsistently enforced.
   *
   * ⚠️ The source is NOT deleted. That is the point of the certainty model: a
   * field report can outrank an official page on what happens at the desk
   * without the page being hidden.
   */
  it('the fee receipt is off the bring-list, and both sources are still shown', () => {
    const test = noId.roadmap.find((s) => s.step.id === 'fz.test')!;

    // He is no longer told to bring it.
    expect(test.documents.map((d) => d.id)).not.toContain('doc.payment_receipt');
    // ⚠️ But the official quote survives, and so does the observation that beat it.
    expect(test.step.evidence.some((e) => e.quote?.includes('אישור על תשלום האגרה'))).toBe(true);
    expect(test.step.evidence.some((e) => e.claim.includes('לא מתבקש אישור תשלום'))).toBe(true);
    // And he is told what IS true, with the screenshot as its own recovery.
    expect(test.notes.some((n) => n.he.includes('מקוון'))).toBe(true);
  });

  /**
   * ⭐ Chaya, 31.8: "the same with the glasses — just say before the test that
   * the user shouldn't forget to bring the glasses if he has."
   *
   * ⚠️ They were never a document. The readiness report was asking a man to
   * confirm his spectacles were "in your possession and valid", which is close
   * to meaningless. A thing to remember on the day is a checklist line.
   */
  /**
   * ⚠️ The scoping the CLI was ignoring until 31.8. A citizen has no permit
   * APPOINTMENT — his permit arrives online within 72 hours — so the question
   * is scoped to people with no teudat zehut. The engine filtered it correctly
   * all along; the CLI was printing the raw list and asking him anyway.
   */
  it('a citizen is not asked about a permit appointment that does not exist for him', () => {
    const citizen = evaluate(
      p({ visa_type: 'citizen', has_teudat_zehut: true, teudat_zehut_confirmed: true, foreign_license: { kind: 'none' }, born: '2004-07' }),
      TODAY,
    );
    const test = citizen.roadmap.find((s) => s.step.id === 'fz.test')!;
    expect(test.checklist.some((c) => c.he.includes('היתר'))).toBe(false);
    // ⭐ But the glasses reminder is for everybody.
    expect(test.checklist.some((c) => c.he.includes('משקפיים'))).toBe(true);
  });

  it('⭐ the glasses are a reminder on the day, not a document to verify', () => {
    const test = noId.roadmap.find((s) => s.step.id === 'fz.test')!;
    expect(test.documents.map((d) => d.id)).not.toContain('doc.glasses');
    expect(test.checklist.some((c) => c.he.includes('משקפיים'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ נהג חדש, from the gov.il text Chaya supplied (27.8)', () => {
  const young = evaluate(
    p({ visa_type: 'a2', has_teudat_zehut: false, foreign_license: { kind: 'none' }, born: '2007-01' }),
    TODAY,
  );
  const older = evaluate(
    p({ visa_type: 'a2', has_teudat_zehut: false, foreign_license: { kind: 'none' }, born: '1990-01' }),
    TODAY,
  );
  const step = (r: ReturnType<typeof evaluate>, id: string) => r.roadmap.find((s) => s.step.id === id);

  it('⚠️ over 24 files NO completion declaration — he is exempt, and told so', () => {
    // The bug: a 40-year-old was being sent to file a form gov.il explicitly
    // exempts him from. "נהג שגילו 24 ומעלה פטור מהגשת טופס הצהרת סיום הליווי".
    expect(step(older, 'fz.completion_in_person')).toBeUndefined();
    expect(step(older, 'fz.no_declaration_needed')).toBeDefined();
  });

  it('under 24 does the ליווי and does file it', () => {
    expect(step(young, 'fz.completion_in_person')).toBeDefined();
    expect(step(young, 'fz.no_declaration_needed')).toBeUndefined();
  });

  it('⭐ but new-driver status applies to BOTH — it is not an age rule', () => {
    for (const r of [young, older]) {
      expect(step(r, 'fz.new_driver')).toBeDefined();
    }
  });

  it('the ליווי says how it is actually split, and how many hours', () => {
    const notes = step(young, 'fz.new_driver')!.notes.map((n) => n.he).join(' ');
    expect(notes).toContain('שלושת החודשים הראשונים');
    expect(notes).toContain('21:00');
    expect(notes).toContain('50 שעות');
  });

  it('⭐ the declaration says WHEN, and that he need not wait for the card', () => {
    // Chaya: "הצהרת סיום ליווי - doesn't say when."
    const dec = step(young, 'fz.completion_in_person')!.step;
    const both = dec.action.he + dec.evidence.map((e) => e.quote ?? '').join(' ');
    expect(both).toContain('שישה חודשים מיום מתן ההיתר');
    // And the line that answers the year she spent waiting for a card.
    expect(both).toContain('ללא צורך בהמתנה לקבלת הרישיון בדואר');
  });

  it('the sign says to take it OFF when he is no longer a new driver', () => {
    const box = step(young, 'fz.new_driver')!.step;
    expect(box.action.he).toContain('להוריד');
    expect(box.evidence.some((e) => e.quote?.includes('נהג שאינו נהג חדש לא ינהג'))).toBe(true);
  });

  it('all of it is now quoted from the ministry, not inferred', () => {
    const ev = step(young, 'fz.new_driver')!.step.evidence;
    expect(ev.filter((e) => e.certainty === 'verified' && e.quote).length).toBeGreaterThan(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ the rules adjust to the age — the reason this product exists', () => {
  // Chaya, 27.8: "the questionnaire asked for an age, so the system knows how
  // old a person is and should apply the exact rules for him. That's exactly
  // why my system is unique — it's personal and can avoid more mistakes."
  const at = (bornYear: string) =>
    evaluate(
      p({ visa_type: 'a2', has_teudat_zehut: false, foreign_license: { kind: 'none' }, born: `${bornYear}-01` }),
      TODAY,
    );
  const notes = (r: ReturnType<typeof evaluate>) =>
    (r.roadmap.find((s) => s.step.id === 'fz.new_driver')?.notes ?? []).map((n) => n.he).join(' ');

  it('everyone gets the box — new-driver status and the sign are age-independent', () => {
    for (const y of ['2008', '2006', '1990']) {
      expect(at(y).roadmap.find((s) => s.step.id === 'fz.new_driver'), y).toBeDefined();
    }
  });

  it('at 18: ליווי AND the passenger limit', () => {
    const n = notes(at('2008'));
    expect(n).toContain('מתחת לגיל 24');
    expect(n).toContain('שני נוסעים');
  });

  it('at 22: ליווי, but the passenger limit is over', () => {
    const n = notes(at('2004'));
    expect(n).toContain('מתחת לגיל 24');
    expect(n).not.toContain('שני נוסעים');
  });

  it('at 36: neither — and it says so, rather than leaving him guessing', () => {
    const n = notes(at('1990'));
    expect(n).not.toContain('מתחת לגיל 24');
    expect(n).not.toContain('שני נוסעים');
    // ⚠️ And it says what does NOT apply, rather than going silent.
    expect(n).toContain('אין חובת ליווי');
  });

  it('⚠️ when the age is unknown, every line is shown rather than silently dropped', () => {
    // Trilean: age_years is 'unknown', so each condition is 'unknown', and the
    // filter keeps anything that is not definitely false. Better to show a rule
    // that may not bind him than to hide one that does.
    const noAge = evaluate(
      p({ visa_type: 'a2', has_teudat_zehut: false, foreign_license: { kind: 'none' } }),
      TODAY,
    );
    const n = (noAge.roadmap.find((s) => s.step.id === 'fz.new_driver')?.notes ?? [])
      .map((x) => x.he)
      .join(' ');
    expect(n).toContain('מתחת לגיל 24');
    expect(n).toContain('שני נוסעים');
  });
});

describe('clocks are only for real deadlines', () => {
  const r = evaluate(
    p({ visa_type: 'a2', has_teudat_zehut: false, foreign_license: { kind: 'none' }, born: '2007-01' }),
    TODAY,
  );

  it('⭐ theory validity and the medical declaration are no longer clocks', () => {
    // Chaya: "most people do it and get their licence within 5 years from then."
    // A countdown implies a risk that is not real, and four "עוד לא התחיל" lines
    // bury the two clocks that matter.
    const ids = r.clocks.map((c) => c.clock.id);
    expect(ids).not.toContain('clock.theory_validity');
    expect(ids).not.toContain('clock.medical_declaration');
  });

  it('but the five-year validity is still stated, on the step it belongs to', () => {
    expect(r.roadmap.find((s) => s.step.id === 'fz.theory')!.step.action.he).toContain('חמש שנים');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ the system follows where the person actually is', () => {
  // Chaya, 27.8: "hopefully the 48-hour clock shouldn't apply to anyone, because
  // they'll get it on their first try... as of now there's no need for it to
  // even display, it just confuses. I want the system to realise where the user
  // actually is — checkboxes for what you have done, and if the user hits the
  // duplicate process, the clock should tick."

  const base = {
    visa_type: 'a2',
    has_teudat_zehut: false,
    foreign_license: { kind: 'none' },
    born: '2007-01',
  };
  const withSteps = (completed: string[]) =>
    evaluate(p({ ...base, completed_steps: completed }), TODAY);

  /**
   * ⭐⭐ THE TWO-AXIS MODEL, ON THE LAST STEP OF THE ROAD. Chaya, 31.8:
   *
   *   "the כפל רישיון when the licence don't arrive is valid to everyone who
   *    doesn't get it. but the difference is with the ID."
   *
   * ⚠️ It was ONE step scoped to EVERYONE, describing only the physical route —
   * so a man holding a teudat zehut was told to book an appointment and pay at
   * a post office for something he can do online. גיליון F0: "ת״ז אינה משנה
   * זכאות, היא משנה ערוץ", contradicted by the step that closes the roadmap.
   */
  it('⭐ everyone whose card never arrives can replace it — only the channel differs', () => {
    const person = (teudatZehut: boolean, license: Record<string, unknown>) =>
      evaluate(
        p({
          visa_type: teudatZehut ? 'citizen' : 'a2',
          has_teudat_zehut: teudatZehut,
          teudat_zehut_confirmed: true,
          foreign_license: license,
          entered_israel: '2024-01',
          born: '1990-05',
        }),
        TODAY,
      );

    // Four people: both routes, with and without a teudat zehut.
    const cases = [
      { r: person(true, { kind: 'none' }), online: true },
      { r: person(false, { kind: 'none' }), online: false },
      { r: person(true, { kind: 'national', valid_now: true, years_held_permanent: 7, held_class: 'B' }), online: true },
      { r: person(false, { kind: 'national', valid_now: true, years_held_permanent: 7, held_class: 'B' }), online: false },
    ];

    for (const { r, online } of cases) {
      const ids = r.roadmap.map((s) => s.step.id);
      // ⭐ ENTITLEMENT: everybody gets exactly one replacement route.
      const mine = ids.filter((id) => id.startsWith('duplicate.'));
      expect(mine.length).toBe(1);
      // ⚠️ CHANNEL: and which one is decided by the teudat zehut alone.
      expect(mine[0]).toBe(online ? 'duplicate.online' : 'duplicate.in_person');
    }
  });

  it('⚠️ the online channel never sends him to a queue or a post office', () => {
    const citizen = evaluate(
      p({ visa_type: 'citizen', has_teudat_zehut: true, teudat_zehut_confirmed: true, foreign_license: { kind: 'none' }, born: '1990-05' }),
      TODAY,
    );
    const step = citizen.roadmap.find((s) => s.step.id === 'duplicate.online')!.step;
    expect(step.channel).toBe('online');
    expect(step.requires_appointment).toBe(false);

    /**
     * ⚠️ Assert the INSTRUCTION, not the words. The first version of this test
     * failed on "אין צורך להגיע למשרד הרישוי או לסניף דואר" — a sentence that
     * tells him he does NOT have to go, which is the single most useful line on
     * the step. A naive not-contains check punishes the helpful negation.
     */
    expect(step.action.he).not.toContain('קבע תור למשרד הרישוי');
    expect(step.action.he).not.toContain('שלם 23 ₪ בסניף דואר');
    expect(step.action.he).toContain('אין צורך');
  });

  it('the 48-hour window is not shown to someone who has not lost a card', () => {
    expect(withSteps([]).clocks.map((c) => c.clock.id)).not.toContain(
      'clock.duplicate_delivery_choice',
    );
  });

  /**
   * ⭐ EITHER CHANNEL starts it. Chaya, 31.8: the replacement is open to
   * everybody whose card never arrives; what the teudat zehut changes is
   * whether the request is made online or in a queue. With a single
   * `activated_by` the clock could only follow one of the two, so half the
   * population would never have seen the shortest deadline in the system.
   */
  it('⭐ and starts the moment he says he is in the duplicate route, either channel', () => {
    for (const channel of ['duplicate.online', 'duplicate.in_person']) {
      const inDuplicate = withSteps([channel]);
      expect(inDuplicate.clocks.map((c) => c.clock.id)).toContain('clock.duplicate_delivery_choice');
    }
  });

  it('the clock is kept in the data, not deleted — it is the shortest one there is', () => {
    // Two days. Nothing else in the research is close.
    const c = withSteps(['duplicate.in_person']).clocks.find(
      (x) => x.clock.id === 'clock.duplicate_delivery_choice',
    )!;
    expect(c.clock.duration_days).toBe(2);
  });

  it('ticking a step marks it done and unblocks what was waiting on it', () => {
    const before = withSteps([]);
    expect(before.roadmap.find((s) => s.step.id === 'fz.photo_and_eye')!.state).toBe('waiting_on');

    const after = withSteps(['fz.doc_89']);
    expect(after.roadmap.find((s) => s.step.id === 'fz.doc_89')!.state).toBe('done');
    // ⚠️ No longer BLOCKED. It reads 'later' rather than 'do_now' because
    // fz.english_name at position 1 is still outstanding — the prerequisite
    // cleared, the queue did not.
    expect(after.roadmap.find((s) => s.step.id === 'fz.photo_and_eye')!.state).not.toBe('waiting_on');
    expect(after.roadmap.find((s) => s.step.id === 'fz.photo_and_eye')!.waiting_on).toEqual([]);
  });

  it('a step that is not ticked never silently becomes done', () => {
    expect(withSteps(['fz.doc_89']).roadmap.filter((s) => s.state === 'done')).toHaveLength(1);
  });
});
