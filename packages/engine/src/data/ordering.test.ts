import { describe, it, expect } from 'vitest';
import { NohalCategory, NOHAL_CATEGORY_LABEL } from '../condition';
import { Profile } from '../profile';
import { evaluate } from '../evaluate';
import { ALL_STEPS } from './index';

/**
 * ============================================================================
 * THREE FIXES THAT SHIPPED WITHOUT A TEST
 * ============================================================================
 *
 * The M0 checker (24.9) failed the build partly because three engine commits
 * were live with nothing to stop them coming undone. The founder, 4.10: each gets a
 * test, and each test is proved by breaking the fix and watching it fail.
 *
 *   8d559be · a person was shown an internal code instead of a name
 *   b1e1b68 · a booking step claimed to happen at the licensing office
 *   0548ba2 · the practical test could be ticked before a single lesson
 */

const stepById = (id: string) => {
  const step = ALL_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`No step "${id}"`);
  return step;
};

// ─────────────────────────────────────────────────────────────────────────────

describe('8d559be · every procedure category has a name a person can read', () => {
  /* The type already forces a key per category. What it cannot force is that
     the value says something: an empty string, or the code itself pasted in
     as the "name", passes the type and puts `toshav_medinat_chutz` back on
     his screen. */
  for (const category of NohalCategory.options) {
    it(`${category} has a Hebrew and English name that is not the code`, () => {
      const label = NOHAL_CATEGORY_LABEL[category];
      expect(label?.he?.trim()).toBeTruthy();
      expect(label?.en?.trim()).toBeTruthy();
      expect(label.he).not.toContain(category);
      expect(label.en).not.toContain(category);
      expect(label.he).not.toMatch(/[a-z]_[a-z]/);
    });
  }

  it('the three categories the procedure defines cite their clause', () => {
    expect(NOHAL_CATEGORY_LABEL.oleh_chadash.he).toContain('1(א)');
    expect(NOHAL_CATEGORY_LABEL.toshav_israel.he).toContain('1(ב)');
    expect(NOHAL_CATEGORY_LABEL.toshav_medinat_chutz.he).toContain('1(ג)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('b1e1b68 · a step\'s channel is where the step happens', () => {
  it('booking the permit appointment happens online, not at the office it books', () => {
    expect(stepById('fz.book_permit_appointment').channel).toBe('online');
  });

  /* The class of error, not just the one instance: a booking or a form names
     the office it leads to, and that office is easy to copy into its channel. */
  const bookingsAndForms = ALL_STEPS.filter((s) => /(^|\.)(book_|online_form)/.test(s.id));

  it('the rule sees every booking and form step there is', () => {
    expect(bookingsAndForms.map((s) => s.id).sort()).toEqual(
      ['cv.book_appointment', 'cv.online_form', 'fz.book_permit_appointment', 'fz.online_form'].sort(),
    );
  });

  for (const step of bookingsAndForms) {
    it(`${step.id} is online`, () => {
      expect(step.channel).toBe('online');
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

describe('0548ba2 · what has to come before what, on the from-zero road', () => {
  it('the practical test waits on theory, lessons and the internal test', () => {
    expect(stepById('fz.test').must_come_after).toEqual(
      expect.arrayContaining(['fz.theory', 'fz.lessons', 'fz.internal_test']),
    );
  });

  /* ⭐ the founder's rule, asked rather than assumed: lessons need the green form and
     the eye test and nothing else. Making them wait on theory would block a
     person who is entitled to be out driving, and look reasonable in review. */
  it('⭐ lessons do NOT wait on the theory test', () => {
    expect(stepById('fz.lessons').must_come_after).not.toContain('fz.theory');
    expect(stepById('fz.lessons').must_come_after).toEqual(
      expect.arrayContaining(['fz.online_form', 'fz.photo_and_eye']),
    );
  });

  it('the internal test waits on lessons', () => {
    expect(stepById('fz.internal_test').must_come_after).toContain('fz.lessons');
  });

  /* ⚠️ Added after the 4.10 re-review. The tests above pinned the links into
     the practical test and the lessons, and nothing else: the checker cut
     "permit after test" and "card after fee" and all 408 stayed green. So the
     whole declared chain is written out here. Changing the order of the road
     means changing this table on purpose, never by accident. */
  const FROM_ZERO_ORDER: Record<string, string[]> = {
    'fz.doc_89': [],
    'fz.online_form': ['fz.doc_89'],
    'fz.photo_and_eye': ['fz.doc_89'],
    'fz.theory': ['fz.online_form', 'fz.photo_and_eye'],
    'fz.lessons': ['fz.online_form', 'fz.photo_and_eye'],
    'fz.internal_test': ['fz.lessons'],
    'fz.book_permit_appointment': [],
    'fz.test': ['fz.theory', 'fz.lessons', 'fz.internal_test'],
    'fz.permit_online': ['fz.test'],
    'fz.permit_in_person': ['fz.test'],
    'fz.permit_fee': ['fz.permit_in_person'],
    'fz.new_driver': ['fz.permit_online', 'fz.permit_in_person'],
    'fz.completion_online': ['fz.new_driver'],
    'fz.completion_in_person': ['fz.new_driver'],
    'fz.plastic_fee': ['fz.completion_online', 'fz.completion_in_person', 'fz.no_declaration_needed'],
    'fz.no_declaration_needed': [],
    'fz.receive_card': ['fz.plastic_fee'],
  };

  it('the table covers every from-zero step there is', () => {
    const ids = ALL_STEPS.filter((s) => s.id.startsWith('fz.')).map((s) => s.id).sort();
    expect(ids).toEqual(Object.keys(FROM_ZERO_ORDER).sort());
  });

  for (const [id, before] of Object.entries(FROM_ZERO_ORDER)) {
    it(`${id} waits on exactly: ${before.join(', ') || 'nothing'}`, () => {
      expect([...stepById(id).must_come_after].sort()).toEqual([...before].sort());
    });
  }

  it('every declared prerequisite is a step that exists', () => {
    const ids = new Set(ALL_STEPS.map((s) => s.id));
    for (const step of ALL_STEPS) {
      for (const before of step.must_come_after) {
        expect(ids.has(before), `${step.id} waits on unknown "${before}"`).toBe(true);
      }
    }
  });

  /* The invariant that matters most. A circle, or a root step hung on a
     condition that excludes him, and every step reads "waiting on something
     else" with nothing he can do. So walk the whole road the way a person
     would: do whatever is open, tick it, ask again. At every point something
     must be open, and the walk must end with everything done. */
  it('⭐ a person can always walk the road to the end, never stuck with nothing to start', () => {
    const base = {
      visa_type: 'a2',
      visa_valid_now: true,
      foreign_license: { kind: 'none' },
      has_teudat_zehut: false,
      teudat_zehut_confirmed: true,
      born: '2005-01',
      entered_israel: '2010-06',
    };
    const done: string[] = [];

    for (let round = 0; round < 40; round++) {
      const r = evaluate(Profile.parse({ ...base, completed_steps: done }), '2026-10-04');
      expect(r.blocked).toBeNull();
      const open = r.roadmap.filter((s) => s.state === 'do_now').map((s) => s.step.id);
      if (round === 0) expect(r.roadmap.length).toBeGreaterThan(5);
      const left = r.roadmap.filter((s) => s.state !== 'done');
      if (left.length === 0) return;
      expect(open.length, `stuck after ${done.join(', ') || 'nothing'}`).toBeGreaterThan(0);
      done.push(...open);
    }
    throw new Error('the road never finished in 40 rounds');
  });
});
