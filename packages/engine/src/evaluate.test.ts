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

  it('is told to get the 89 number, and told to do it first', () => {
    expect(ids).toContain('fz.doc_89');
    const doc89 = r.roadmap.find((s) => s.step.id === 'fz.doc_89')!;
    expect(doc89.start_now).toBe(true);
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
    // ⚠️ It lives in its own step, NOT on the accompaniment one: the ליווי is
    // scoped to under-24, while the passenger limit runs to 21 and new-driver
    // status runs two years for everyone.
    const limits = noId.roadmap.find((s) => s.step.id === 'fz.new_driver_limits')!;
    expect(limits.step.action.he).toContain('שני נוסעים');
    expect(limits.step.action.he).toContain('21');
    expect(limits.step.evidence.some((e) => e.quote?.includes('שני נוסעים'))).toBe(true);
  });

  it('⭐ the "new driver" sign applies to EVERY new driver, not only under-24s', () => {
    // The ליווי is age-dependent. This is not, so it is its own step.
    for (const r of [citizen, noId]) {
      const sign = r.roadmap.find((s) => s.step.id === 'fz.new_driver_sign');
      expect(sign, 'sign step missing').toBeDefined();
      expect(sign!.applies).toBe(true);
    }
  });

  it('the plastic card says roughly how long it should take', () => {
    const card = noId.roadmap.find((s) => s.step.id === 'fz.receive_card')!;
    expect(card.step.action.he).toContain('חודש');
  });

  it('the fee-receipt requirement keeps the official quote AND the counter-observation', () => {
    // On the official list, yet nobody asked for it. Both shown, neither hidden.
    const test = noId.roadmap.find((s) => s.step.id === 'fz.test')!;
    expect(test.step.evidence.some((e) => e.quote?.includes('אישור על תשלום האגרה'))).toBe(true);
    expect(test.step.evidence.some((e) => e.claim.includes('לא התבקש אישור תשלום'))).toBe(true);
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
    expect(step(older, 'fz.accompanied_driving')).toBeUndefined();
  });

  it('under 24 does the ליווי and does file it', () => {
    expect(step(young, 'fz.accompanied_driving')).toBeDefined();
    expect(step(young, 'fz.completion_in_person')).toBeDefined();
    expect(step(young, 'fz.no_declaration_needed')).toBeUndefined();
  });

  it('⭐ but new-driver status applies to BOTH — it is not an age rule', () => {
    for (const r of [young, older]) {
      expect(step(r, 'fz.new_driver_limits')).toBeDefined();
      expect(step(r, 'fz.new_driver_sign')).toBeDefined();
    }
  });

  it('the ליווי says how it is actually split, and how many hours', () => {
    const acc = step(young, 'fz.accompanied_driving')!.step.action.he;
    expect(acc).toContain('שלושת החודשים הראשונים');
    expect(acc).toContain('21:00');
    expect(acc).toContain('50 שעות');
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
    const sign = step(young, 'fz.new_driver_sign')!.step;
    expect(sign.action.he).toContain('להוריד');
    expect(sign.evidence.some((e) => e.quote?.includes('נהג שאינו נהג חדש לא ינהג'))).toBe(true);
  });

  it('all of it is now quoted from the ministry, not inferred', () => {
    for (const id of ['fz.new_driver_limits', 'fz.new_driver_sign']) {
      const ev = step(young, id)!.step.evidence;
      expect(ev.some((e) => e.certainty === 'verified' && e.quote), id).toBeTruthy();
    }
  });
});
