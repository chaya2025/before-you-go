/**
 * ============================================================================
 * The notice before he enters anything (SEC M2, D-6, D-7)
 * ============================================================================
 *
 * The law (s.11) asks that a person is told, BEFORE he hands over information,
 * whether he has to, what it's for and who processes it. One short notice and
 * one checkbox, at the start of the flow.
 *
 * ⚠️ Browser only (D-2, her call). Nothing is sent or stored on the server.
 * The tick lives in sessionStorage: this tab only, gone when the tab closes,
 * so it is asked once per visit, not on every screen.
 */

const KEY = 'byg.consent';

/** Every screen of the flow. Only the landing page asks for nothing. */
type FlowScreen = 'welcome' | 'intake' | 'diagnosis' | 'documents' | 'roadmap';

/**
 * ⭐ ONE rule for every way in. Not "after the start button": a saved case
 * opens straight on the road, the return from Google reloads the page, the
 * browser's back and forward can land on any screen, and ?demo jumps to the
 * upload. Gating every screen past the landing page covers all of them,
 * including ones nobody has thought of yet.
 */
export function needsConsent(screen: FlowScreen, consented: boolean): boolean {
  return screen !== 'welcome' && !consented;
}

const store = (): Storage | null => {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
};

export function hasConsented(s: Storage | null = store()): boolean {
  try {
    return s?.getItem(KEY) === '1';
  } catch {
    return false; // private mode: ask again, never break
  }
}

export function rememberConsent(s: Storage | null = store()) {
  try {
    s?.setItem(KEY, '1');
  } catch {
    /* private mode: he is asked again next screen load, nothing else breaks */
  }
}

/** "Start over" and logging out: the next case, or the next person, is asked again. */
export function forgetConsent(s: Storage | null = store()) {
  try {
    s?.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}
