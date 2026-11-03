import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsentView } from './components/Consent';
import { forgetConsent, hasConsented, needsConsent, rememberConsent } from './consent';

/**
 * SEC M2 (D-6, D-7): one notice and one checkbox before he enters anything.
 * Browser only (D-2): nothing here talks to the server.
 */

const noop = () => {};
const view = (lang: 'he' | 'en', checked: boolean) =>
  renderToStaticMarkup(<ConsentView lang={lang} checked={checked} onCheck={noop} onContinue={noop} />);

/** The continue button's own tag, so "disabled" is read off that button only. */
const continueButton = (html: string) => html.match(/<button[^>]*>/)?.[0] ?? '';

/** A stand-in for sessionStorage. */
function memoryStore(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  };
}

describe('the notice blocks until checked', () => {
  it("can't continue while the box is unchecked", () => {
    const html = view('en', false);
    expect(html).toContain('type="checkbox"');
    expect(continueButton(html)).toContain('disabled');
  });

  it('checking the box lets him continue', () => {
    expect(continueButton(view('en', true))).not.toContain('disabled');
    expect(continueButton(view('he', true))).not.toContain('disabled');
  });
});

describe('every way into the flow passes the notice', () => {
  // The landing page asks for nothing, so it is not gated.
  it('the landing page needs no notice', () => {
    expect(needsConsent('welcome', false)).toBe(false);
  });

  // intake: "start" on the landing page, ?demo=intake, browser back/forward.
  // diagnosis/documents: history after a reload, ?demo=documents, back from the road.
  // roadmap: a resumed saved case, the return from Google, ?demo. Its back
  // button leads to the documents upload, and its update forms take answers.
  it.each(['intake', 'diagnosis', 'documents', 'roadmap'] as const)('%s shows the notice until he agrees', (screen) => {
    expect(needsConsent(screen, false)).toBe(true);
    expect(needsConsent(screen, true)).toBe(false);
  });
});

describe('remembered for the session, in the browser only', () => {
  it('asked once, then remembered', () => {
    const s = memoryStore();
    expect(hasConsented(s)).toBe(false);
    rememberConsent(s);
    expect(hasConsented(s)).toBe(true);
  });

  it('a new case asks again', () => {
    const s = memoryStore();
    rememberConsent(s);
    forgetConsent(s);
    expect(hasConsented(s)).toBe(false);
  });

  it('blocked storage (private mode) means ask, never a crash', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(() => rememberConsent(broken)).not.toThrow();
    expect(hasConsented(broken)).toBe(false);
  });
});

describe('both languages', () => {
  it('English: the standard checkbox, linked to the privacy policy', () => {
    expect(view('en', false)).toMatch(/I have read and agree to the <a href="\/privacy"[^>]*>Privacy Policy<\/a>/);
  });

  it('Hebrew says the same, in Hebrew', () => {
    expect(view('he', false)).toMatch(/קראתי ואני מאשר את <a href="\/privacy"[^>]*>מדיניות הפרטיות<\/a>/);
  });

  // D-7: she wants people to fill in everything.
  it('never calls it optional', () => {
    expect(view('en', false).toLowerCase()).not.toContain('optional');
    expect(view('he', false)).not.toMatch(/רשות|אופציונלי/);
  });
});
