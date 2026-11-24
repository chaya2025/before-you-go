import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { askQuestion, type AskReply } from './api';
import { AskPanel, answerBlocks, historyFrom, quickKind, type AskEntry } from './components/AskPanel';
import { UI } from './i18n';

/**
 * ⭐ M6 "ask your case" on the website (CONTRACT.md section 3 + 4).
 *
 * Two halves:
 *   1. askQuestion, the one function that talks to the assistant service.
 *      The rule it must keep: it NEVER throws. Whatever goes wrong comes back
 *      as a status the panel knows how to say calmly.
 *   2. The panel, rendered to plain HTML (no browser), once per state.
 */

afterEach(() => vi.unstubAllGlobals());

/** A fake fetch that records what it was sent and answers with `body`. */
function fakeFetch(body: unknown, status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}
const sent = (fn: ReturnType<typeof fakeFetch>) => JSON.parse(String(fn.mock.calls[0]?.[1]?.body));

const answered: AskReply = {
  status: 'answered',
  answer: 'Bring form 89.',
  sources: [{ citation: 'נוהל המרה', url: 'https://www.gov.il/x', last_verified_at: '2026-10-18' }],
};

describe('askQuestion', () => {
  it('sends the login token as a Bearer header, to /api/v1/ask', async () => {
    const fn = fakeFetch(answered);
    const reply = await askQuestion({ question: 'q', lang: 'he', mode: 'general' }, 'tok-123');
    expect(reply).toEqual(answered);
    const [url, init] = fn.mock.calls[0]!;
    expect(url).toMatch(/\/api\/v1\/ask$/);
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('no token: no_login, and nothing is sent', async () => {
    const fn = fakeFetch(answered);
    expect((await askQuestion({ question: 'q', lang: 'he', mode: 'general' }, undefined)).status).toBe('no_login');
    expect(fn).not.toHaveBeenCalled();
  });

  it('a network error is "unavailable", never a throw', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const reply = await askQuestion({ question: 'q', lang: 'en', mode: 'general' }, 'tok');
    expect(reply.status).toBe('unavailable');
  });

  it('a 500, or a body that is not the contract, is "unavailable"', async () => {
    fakeFetch({ oops: true }, 500);
    expect((await askQuestion({ question: 'q', lang: 'en', mode: 'general' }, 'tok')).status).toBe('unavailable');
    fakeFetch({ status: 'something_new', answer: 'x', sources: [] });
    expect((await askQuestion({ question: 'q', lang: 'en', mode: 'general' }, 'tok')).status).toBe('unavailable');
  });

  it('a 401 (expired login) is no_login', async () => {
    fakeFetch({ detail: 'nope' }, 401);
    expect((await askQuestion({ question: 'q', lang: 'en', mode: 'general' }, 'tok')).status).toBe('no_login');
  });

  it('history is capped at the last 6 turns', async () => {
    const fn = fakeFetch(answered);
    const history = Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `t${i}` }) as const);
    await askQuestion({ question: 'q', lang: 'he', mode: 'general', history: [...history] }, 'tok');
    const body = sent(fn);
    expect(body.history).toHaveLength(6);
    expect(body.history[0].text).toBe('t3');
    expect(body.history[5].text).toBe('t8');
  });

  it('case mode sends the profile, the language and the step', async () => {
    const fn = fakeFetch(answered);
    const profile = { visa_type: 'a5', completed_steps: ['s1'] };
    await askQuestion({ question: 'q', lang: 'en', mode: 'case', profile, step_id: 'cv.book_appointment' }, 'tok');
    expect(sent(fn)).toMatchObject({ question: 'q', lang: 'en', mode: 'case', profile, step_id: 'cv.book_appointment' });
  });
});

describe('historyFrom', () => {
  it('keeps real answers and their questions, drops the ones that never got one', () => {
    const log: AskEntry[] = [
      { role: 'user', text: 'a' },
      { role: 'assistant', reply: answered },
      { role: 'user', text: 'b' },
      { role: 'assistant', reply: { status: 'unavailable', answer: '', sources: [] } },
      { role: 'user', text: 'c' },
      { role: 'assistant', reply: { status: 'not_sure', answer: 'not sure', sources: [] } },
    ];
    expect(historyFrom(log)).toEqual([
      { role: 'user', text: 'a' },
      { role: 'assistant', text: 'Bring form 89.' },
      { role: 'user', text: 'c' },
      { role: 'assistant', text: 'not sure' },
    ]);
  });
});

/* ---- the panel ---------------------------------------------------------- */

const noop = () => {};
type Props = Parameters<typeof AskPanel>[0];
const panel = (p: Partial<Props> = {}) =>
  renderToStaticMarkup(
    <AskPanel
      lang="en"
      mode="case"
      loggedIn
      canLogin
      log={[]}
      busy={false}
      step={null}
      onSend={noop}
      onClearStep={noop}
      onClose={noop}
      onLogin={noop}
      {...p}
    />,
  );
/** React escapes apostrophes in HTML, so the copy is compared the same way. */
const esc = (s: string) => s.replace(/'/g, '&#x27;');
const withReply = (reply: AskReply, p: Partial<Props> = {}) =>
  panel({ log: [{ role: 'user', text: 'my question' }, { role: 'assistant', reply }], ...p });

describe('the ask panel', () => {
  it('is a labelled dialog with a labelled box to type in', () => {
    const html = panel();
    expect(html).toContain('role="dialog"');
    expect(html).toContain(`aria-label="${UI.ask_open.en}"`);
    expect(html).toContain(`<label`);
    expect(html).toContain(UI.ask_label.en);
    expect(html).toContain(UI.ask_send.en);
  });

  it('case mode opens with the plain-words summary (passed in as the opening)', () => {
    const html = panel({ opening: <p>THE SUMMARY</p> });
    expect(html).toContain('THE SUMMARY');
    expect(html.indexOf('THE SUMMARY')).toBeLessThan(html.indexOf(UI.ask_label.en));
  });

  it('answered: the answer, and each source with its check date and link', () => {
    const html = withReply(answered);
    expect(html).toContain('my question');
    expect(html).toContain('Bring form 89.');
    expect(html).toContain('נוהל המרה');
    expect(html).toContain('18.10.2026');
    expect(html).toContain('href="https://www.gov.il/x"');
  });

  it('a source without a url has no link', () => {
    const html = withReply({ ...answered, sources: [{ citation: 'BeforeYouGo site', url: null, last_verified_at: null }] });
    expect(html).toContain('BeforeYouGo site');
    expect(html).not.toContain('<a ');
  });

  it('a source with a claim and no citation shows the claim (amendment 1)', () => {
    const html = withReply({ ...answered, sources: [{ claim: 'Form 89 is required', url: null, last_verified_at: null }] });
    expect(html).toContain('Form 89 is required');
  });

  it('not_sure with no words from the server says so in ours', () => {
    expect(withReply({ status: 'not_sure', answer: '', sources: [] })).toContain(esc(UI.ask_not_sure.en));
  });

  it('other_person shows the warm line', () => {
    expect(withReply({ status: 'other_person', answer: '', sources: [] })).toContain(esc(UI.ask_other_person.en));
  });

  it('limit: the calm line, and the box stops taking questions', () => {
    const html = withReply({ status: 'limit', answer: '', sources: [] });
    expect(html).toContain(esc(UI.ask_limit.en));
    expect(html).toMatch(/<input[^>]*disabled/);
  });

  it('unavailable: the calm line, and he can still try again', () => {
    const html = withReply({ status: 'unavailable', answer: '', sources: [] });
    expect(html).toContain(esc(UI.ask_unavailable.en));
    expect(html).not.toMatch(/<input[^>]*disabled/);
  });

  it('not logged in: says logging in opens the chat, offers the login, no box', () => {
    const html = panel({ loggedIn: false });
    expect(html).toContain(UI.ask_no_login.en);
    expect(html).toContain(UI.acct_open.en);
    expect(html).not.toContain('<input');
  });

  it('no_login from the server (login ran out) shows the same way in', () => {
    const html = withReply({ status: 'no_login', answer: '', sources: [] });
    expect(html).toContain(UI.ask_no_login.en);
    expect(html).toContain(UI.acct_open.en);
  });

  it('accounts switched off where deployed: unavailable, no dead login button', () => {
    const html = panel({ loggedIn: false, canLogin: false });
    expect(html).toContain(esc(UI.ask_unavailable.en));
    expect(html).not.toContain(UI.acct_open.en);
  });

  it('loading: says it is checking, and the send waits', () => {
    const html = panel({ busy: true, log: [{ role: 'user', text: 'q' }] });
    expect(html).toContain(UI.ask_thinking.en);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it('asked from a step: a chip naming it, with a way to clear it', () => {
    const html = panel({ step: { id: 'cv.book_appointment', title: 'Book the appointment' } });
    expect(html).toContain(UI.ask_about.en);
    expect(html).toContain('Book the appointment');
    expect(html).toContain(`aria-label="${UI.ask_about_clear.en}"`);
  });

  it('general mode: its own title, Tal greets, no case words (D-235)', () => {
    const html = panel({ mode: 'general' });
    expect(html).toContain(UI.ask_open_general.en);
    expect(html).toContain(esc(UI.ask_hello.en));
    expect(html).not.toContain(UI.ask_open.en);
  });

  it('D-235: dash lines become one bullet list, other lines stay paragraphs', () => {
    expect(answerBlocks('Bring three things.\n- Passport\n- Form 89\n\nThen book.')).toEqual([
      { kind: 'p', text: 'Bring three things.' },
      { kind: 'ul', items: ['Passport', 'Form 89'] },
      { kind: 'p', text: 'Then book.' },
    ]);
  });

  it('D-235: sources fold into one small link with their count', () => {
    const html = withReply(answered);
    expect(html).toContain('<details class="ask-sources">');
    expect(html).toContain(`${UI.ask_sources.en} <span class="ask-count num">1</span>`);
  });

  it('Hebrew renders Hebrew', () => {
    expect(panel({ lang: 'he' })).toContain(UI.ask_send.he);
  });
});

describe('every new ask line has words in both languages, and no em-dash', () => {
  const keys = Object.keys(UI).filter((k) => k.startsWith('ask_'));
  it.each(keys)('%s', (k) => {
    const v = (UI as Record<string, { he: string; en: string }>)[k]!;
    expect(v.he).toBeTruthy();
    expect(v.en).toBeTruthy();
    expect(v.he + v.en).not.toContain('—');
  });
});

/* ---- checker fixes, 2026-11-23 ------------------------------------------ */

import { Profile, deriveFacts } from '@byg/engine';
import { askProfile } from './askProfile';
import { askModeFor } from './components/AskPanel';

/** Everything the documents screen can add, real-looking on purpose. */
const fullProfile = {
  language: 'he',
  visa_type: 'a2',
  visa_valid_now: true,
  has_teudat_zehut: false,
  teudat_zehut_confirmed: true,
  born: '2005-03',
  entered_israel: '2010-06',
  holds_form_89: true,
  form_89_number: '891234567',
  form_89_passport_number: 'AB1234567',
  passport_number: 'CD7654321',
  passport_expires: '2030-01',
  passport_name_latin: 'Oleksandr Petrenko',
  form_89_name_latin: 'Olexandr Petrenko',
  foreign_license: { kind: 'national', name_latin: 'PETRENKO OLEKSANDR', expires: '2029-05', language: 'other' },
  completed_steps: ['s1'],
  some_free_text: 'my neighbour said so',
};
const SECRETS = ['891234567', 'AB1234567', 'CD7654321', 'Oleksandr', 'Olexandr', 'PETRENKO', 'Petrenko', 'neighbour'];

describe('privacy: the chat never sends document numbers or names', () => {
  it('a profile with a passport number and a name never appears in the ask request body', async () => {
    const fn = fakeFetch(answered);
    await askQuestion({ question: 'q', lang: 'en', mode: 'case', profile: fullProfile }, 'tok');
    const raw = String(fn.mock.calls[0]?.[1]?.body);
    for (const s of SECRETS) expect(raw).not.toContain(s);
    expect(sent(fn).profile.visa_type).toBe('a2');
  });

  it('only fields the engine reads survive; free text is dropped', () => {
    const out = askProfile(fullProfile);
    expect(out).not.toHaveProperty('some_free_text');
    expect(out.completed_steps).toEqual(['s1']);
    expect((out.foreign_license as Record<string, unknown>).kind).toBe('national');
  });

  /**
   * ⭐ The point of the stand-ins: the service rebuilds HIS road, so the
   * engine must reach the same facts (89 held, numbers match or not, names
   * match or not) from the cleaned profile as from the real one.
   */
  const cases: Record<string, Record<string, unknown>> = {
    'numbers differ, names differ': fullProfile,
    'numbers and names agree': {
      ...fullProfile,
      passport_number: 'ab-1234567',
      form_89_name_latin: 'PETRENKO OLEKSANDR',
    },
    'only an 89 number, nothing to compare': { ...fullProfile, form_89_passport_number: undefined, passport_name_latin: undefined },
    'nothing from the documents screen': { visa_type: 'a5', foreign_license: { kind: 'none' } },
  };
  it.each(Object.keys(cases))('same engine facts: %s', (name) => {
    const real = Profile.parse(cases[name]);
    const clean = Profile.parse(askProfile(cases[name]!));
    expect(deriveFacts(clean, '2026-11-23')).toEqual(deriveFacts(real, '2026-11-23'));
  });
});

describe('other_person (D-226): a way to start his road', () => {
  const other: AskReply = { status: 'other_person', answer: 'Only your case.', sources: [] };

  it('nothing of his to lose: a button that starts a new road', () => {
    const html = withReply(other, { otherPerson: 'start' });
    expect(html).toContain(UI.ask_other_start.en);
    expect(html).not.toContain(UI.ask_other_home.en);
  });

  it('starting would replace his saved case: the home page instead', () => {
    const html = withReply(other, { otherPerson: 'home' });
    expect(html).toContain(UI.ask_other_home.en);
    expect(html).not.toContain(UI.ask_other_start.en);
  });

  it('not shown under an ordinary answer', () => {
    const html = withReply(answered, { otherPerson: 'start' });
    expect(html).not.toContain(UI.ask_other_start.en);
  });
});

describe('where the chat may appear', () => {
  it('a blocked road never gets the chat', () => {
    expect(askModeFor({ screen: 'roadmap', hasResult: true, blocked: true, hasAnswers: true })).toBeNull();
  });
  it('an open road is case mode', () => {
    expect(askModeFor({ screen: 'roadmap', hasResult: true, blocked: false, hasAnswers: true })).toBe('case');
  });
  it('the landing page and the questions are general mode', () => {
    expect(askModeFor({ screen: 'welcome', hasResult: false, blocked: false, hasAnswers: false })).toBe('general');
    expect(askModeFor({ screen: 'intake', hasResult: false, blocked: false, hasAnswers: false })).toBe('general');
  });
  it('diagnosis and documents: no chat', () => {
    expect(askModeFor({ screen: 'diagnosis', hasResult: true, blocked: false, hasAnswers: true })).toBeNull();
    expect(askModeFor({ screen: 'documents', hasResult: true, blocked: false, hasAnswers: true })).toBeNull();
  });
});

import { Privacy } from './components/Privacy';

describe('the privacy page tells about the chat', () => {
  it.each(['he', 'en'] as const)('%s: Voyage, Anthropic, 20 a day, nothing saved, no em-dash', (lang) => {
    const html = renderToStaticMarkup(<Privacy lang={lang} onBack={noop} />);
    expect(html).toContain('Voyage AI');
    expect(html).toContain('Anthropic');
    expect(html).toContain('20');
    expect(html).toContain(lang === 'he' ? '23.11.2026' : '23 November 2026');
    expect(html).not.toContain('—');
  });
});

describe('D-238: quick replies in the browser', () => {
  it('whole small-talk messages are caught, punctuation and case ignored', () => {
    expect(quickKind('תודה רבה!!')).toBe('thanks');
    expect(quickKind('  היי ')).toBe('hello');
    expect(quickKind('Thanks!')).toBe('thanks');
    expect(quickKind('אוקיי, הבנתי')).toBe('ok');
    expect(quickKind('ביי')).toBe('bye');
  });

  it('anything with a question in it goes to the server', () => {
    expect(quickKind('תודה, וכמה זה עולה?')).toBeNull();
    expect(quickKind('היי, מה להביא לתור?')).toBeNull();
    expect(quickKind('')).toBeNull();
  });

  it('typing a quick reply shows the dots without the "checking" words', () => {
    const html = panel({ busy: true, quiet: true, log: [{ role: 'user', text: 'היי' }] });
    expect(html).toContain('ask-dots');
    expect(html).not.toContain(UI.ask_thinking.en);
  });
});
