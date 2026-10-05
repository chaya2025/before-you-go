import { useEffect, useState } from 'react';
import type { Result, Process } from '@byg/engine';
import { fetchStatuses, fetchReadiness, fetchCapabilities, fetchProcesses, ValidationError, type StatusesResponse } from './api';
import { UI, pick, dirFor, type Lang } from './i18n';
import { Intake, type Answers } from './components/Intake';
import { Diagnosis, Blocked } from './components/Diagnosis';
import { Documents } from './components/Documents';
import { Roadmap, RoadSide } from './components/Roadmap';
import { Urgent } from './components/Urgent';
import { Readiness } from './components/Readiness';
import { PlainWords } from './components/PlainWords';
import { Warnings } from './components/Warnings';
import { Welcome } from './components/Welcome';
import { AccountPanel, type PanelMode } from './components/AccountPanel';
import { AccountMenu } from './components/AccountMenu';
import { accountsEnabled, getAccount, onAccountChange, type Account } from './account';
import { useReveal } from './useReveal';

/**
 * ============================================================================
 * Before You Go
 * ============================================================================
 *
 * Four screens:
 *
 *   intake → diagnosis → documents → roadmap
 *
 * The diagnosis step is not a nicety. F1 step 17 marks it חובה, because
 * "טעות באבחון מייצרת רודמאפ שגוי לגמרי" — so the user confirms what the
 * system concluded before he is shown a road built on it.
 *
 * ⭐ Documents was added 30.8, and its position is the founder's:
 *
 *   AFTER the diagnosis, because only then do we know which documents his
 *   route actually needs, and asking for the rest is friction for nothing.
 *
 *   BEFORE the roadmap, because a document that is wrong does not get a
 *   warning printed beside the road — it BECOMES the first step on it. Her
 *   words: "they realize that he has to change his name. That should be the
 *   next step for him."
 */

/**
 * ⚠️ ONE list, in order, so the flow and the progress rail cannot disagree.
 * A second hardcoded array in the header would drift the first time a screen
 * is added, and the rail would quietly point at the wrong mark.
 */
const SCREENS = ['intake', 'diagnosis', 'documents', 'roadmap'] as const;

/**
 * ⚠️ 'welcome' is deliberately OUTSIDE that list. The rail measures progress
 * through the questions, and the landing page is before the questions start —
 * counting it would tell a person he is a fifth of the way through a form he
 * has not begun.
 */
type Screen = (typeof SCREENS)[number] | 'welcome';

export function App() {
  const [lang, setLang] = useState<Lang>('he');
  const [screen, setScreen] = useState<Screen>('welcome');
  const [statuses, setStatuses] = useState<StatusesResponse | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  /** Kept so ticking a step can re-run the engine with the same answers. */
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  /** Which step's tick is in flight, so the row he pressed can say so. */
  const [pendingStep, setPendingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Whether the plain-language layer is switched on where this is deployed. */
  const [plainLanguage, setPlainLanguage] = useState(false);
  /** What the system can check readiness for. Served, never hardcoded here. */
  const [processes, setProcesses] = useState<Process[]>([]);
  /** The plain-words panel, opened from the button in the corner. */
  const [asking, setAsking] = useState(false);

  const t = (k: keyof typeof UI) => pick(UI[k], lang);

  /**
   * ⭐ Accounts (M1). Optional: nothing below depends on being logged in yet.
   * `panel` is which mode the account window is open in, or null when closed.
   * Arriving from a reset-password email opens it on "choose a new password".
   */
  const [account, setAccount] = useState<Account>(null);
  const [panel, setPanel] = useState<PanelMode | null>(null);
  useEffect(() => {
    if (!accountsEnabled) return;
    getAccount().then(setAccount);
    return onAccountChange((a, recovering) => {
      setAccount(a);
      if (recovering) setPanel('newpass');
    });
  }, []);

  /* Motion, on the landing page only. Nothing past it moves. */
  useReveal(screen === 'welcome', processes.length);

  /**
   * ⚠️ The direction of the whole document changes with the language, not just
   * the words. Hebrew right-to-left, English left-to-right, layout mirrored.
   * "כיווניות RTL מלאה מהיסוד, לא כשכבת תיקון."
   */
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
  }, [lang]);

  /**
   * ⚠️ DEVELOPMENT ONLY, and gated on import.meta.env.DEV so it cannot exist in
   * a built site. `?demo` fills in the documented persona and jumps straight to
   * the road, because reaching that screen otherwise means answering the whole
   * form by hand every time it is looked at — and a screen nobody looks at is
   * a screen nobody notices is broken.
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (demo === null) return;
    const persona = {
      language: 'he',
      visa_type: 'a2',
      visa_valid_now: true,
      foreign_license: { kind: 'none' },
      has_teudat_zehut: false,
      teudat_zehut_confirmed: true,
      born: '2005-01',
      entered_israel: '2010-06',
    } as unknown as Answers;
    if (demo === 'intake') {
      setScreen('intake');
      return;
    }
    setAnswers(persona);
    fetchReadiness(persona).then((r) => {
      setResult(r);
      /* ?demo=diagnosis · ?demo=documents · anything else lands on the road. */
      setScreen(demo === 'diagnosis' || demo === 'documents' ? demo : 'roadmap');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * ⭐ FOUND WHEN THE ROAD BECAME ROWS, 22.9. A folded <details> does not
   * print: the browser leaves its contents out of the printed document
   * entirely. Fifteen of the sixteen steps are folded by default now, so the
   * sheet a person carries into the office — the whole reason this product
   * has a print view — would have come out with one step on it and no warning.
   *
   * Everything opens for the print and goes back to how he left it after,
   * including a fold he opened himself.
   */
  useEffect(() => {
    let reclose: Element[] = [];
    const openAll = () => {
      reclose = [...document.querySelectorAll('details:not([open])')];
      for (const d of reclose) d.setAttribute('open', '');
    };
    const restore = () => {
      for (const d of reclose) d.removeAttribute('open');
      reclose = [];
    };
    window.addEventListener('beforeprint', openAll);
    window.addEventListener('afterprint', restore);
    return () => {
      window.removeEventListener('beforeprint', openAll);
      window.removeEventListener('afterprint', restore);
    };
  }, []);

  /** The visa list comes from the API, so this app holds no domain knowledge. */
  useEffect(() => {
    fetchStatuses()
      .then(setStatuses)
      .catch(() => setError(t('error_offline')));
    // ⚠️ Asked, not assumed. "Switched off here" and "it failed" are different
    // sentences and the user gets the true one.
    fetchCapabilities()
      .then((c) => setPlainLanguage(c.plain_language))
      .catch(() => setPlainLanguage(false));
    fetchProcesses()
      .then((p) => setProcesses(p.processes))
      .catch(() => setProcesses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(a: Answers, completed: string[] = []) {
    setBusy(true);
    setError(null);
    setAnswers(a);
    setDone(completed);
    try {
      const r = await fetchReadiness({ ...a, completed_steps: completed });
      setResult(r);
      // A blocked result has no roadmap to confirm a diagnosis for.
      setScreen(r.blocked ? 'roadmap' : 'diagnosis');
    } catch (err) {
      setError(
        err instanceof ValidationError
          ? err.issues.map((i) => `${i.field}: ${i.message}`).join(' · ')
          : t('error_offline'),
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * ⭐ The documents are not a separate thing the engine knows about. They are
   * more answers on the same profile, so this merges and re-runs — which is why
   * a mismatch can come back as a STEP rather than as a special kind of alert.
   *
   * ⚠️ foreign_license is merged rather than replaced. The intake already put
   * `kind` and the seniority there, and overwriting it with only the expiry
   * would silently throw away the answer that decides his entire route.
   */
  async function submitDocuments(documents: Answers) {
    if (!answers) return;
    const merged: Answers = {
      ...answers,
      ...documents,
      ...(documents.foreign_license
        ? {
            foreign_license: {
              ...(answers.foreign_license as object),
              ...(documents.foreign_license as object),
            },
          }
        : {}),
    };
    setBusy(true);
    setError(null);
    setAnswers(merged);
    try {
      setResult(await fetchReadiness({ ...merged, completed_steps: done }));
      setScreen('roadmap');
    } catch (err) {
      setError(
        err instanceof ValidationError
          ? err.issues.map((i) => `${i.field}: ${i.message}`).join(' · ')
          : t('error_offline'),
      );
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setResult(null);
    setAnswers(null);
    setDone([]);
    // ⚠️ Back to the landing page, not into the visa question. Starting over
    // should not drop somebody straight back into the coldest screen.
    setScreen('welcome');
    setError(null);
  }

  /**
   * ⭐ Ticking a step re-runs the WHOLE engine with it marked done.
   *
   * Not a cosmetic strike-through: the next step unblocks, the progress moves,
   * and a clock that only exists once you are in a particular situation starts
   * ticking. The founder's design — "I want the system to realise where the user
   * actually is."
   */
  async function toggleStep(id: string, isDone: boolean) {
    if (!answers) return;
    setPendingStep(id);
    /**
     * ⚠️ Found in M5, and it was not cosmetic. The tick was written into
     * `done` BEFORE the call, and on a failed call it stayed there. The
     * checkbox itself corrected: it reads the engine's result, which had not
     * changed. But `done` had, so the NEXT successful call would have sent a
     * step he never confirmed, and the road would have been built on it.
     * A silent wrong answer is the one failure this product cannot have.
     */
    const before = done;
    const next = isDone ? [...done, id] : done.filter((x) => x !== id);
    setDone(next);
    setBusy(true);
    setError(null);
    try {
      setResult(await fetchReadiness({ ...answers, completed_steps: next }));
    } catch {
      setDone(before);
      setError(t('error_step'));
    } finally {
      setBusy(false);
      setPendingStep(null);
    }
  }

  /**
   * ⭐ A dead end is not an error state. Whatever failed, the way out is the
   * same: do the last thing again. With answers in hand that means re-running
   * the engine; before that it means fetching the question list again.
   */
  async function retry() {
    setError(null);
    if (!answers) {
      fetchStatuses()
        .then(setStatuses)
        .catch(() => setError(t('error_offline')));
      return;
    }
    setBusy(true);
    try {
      setResult(await fetchReadiness({ ...answers, completed_steps: done }));
    } catch {
      setError(t('error_offline'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * ⚠️ ONE notice, defined once and shown on every screen. It used to live
   * inside the narrow-column layout only, so a failure while ticking a step
   * on the answer page — the one screen where ticking happens — was rendered
   * nowhere at all. He pressed, nothing moved, and nothing said why.
   */
  const failure = error ? (
    <div className="card fail" role="alert">
      <h3>{t('error_title')}</h3>
      <p className="small">{error}</p>
      <button className="btn btn-quiet" onClick={retry} disabled={busy}>
        {busy ? t('loading') : t('retry')}
      </button>
    </div>
  ) : null;

  const header = (
    <header className="mast">
      <div className="mast-in">
        <div className="mark">
          {/**
           * ⭐ The seal. The PRD's own statement of the brand is
           * "נקודת אור אחת בענבר שמסמנת היכן אתה עומד", drawn here as a stamp:
           * a ruled circle, a dashed inner ring, the amber point at the centre,
           * four marks at the compass points. Drawn rather than an image file,
           * so it takes the ink colour and needs no load.
           */}
          <svg className="seal" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <circle cx="20" cy="20" r="18.25" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="13.5" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 3" />
            <circle cx="20" cy="20" r="4.6" fill="var(--amber)" />
            <path d="M20 2.2v4M20 33.8v4M2.2 20h4M33.8 20h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="mark-txt">
            <h1 className="ltr">{t('brand')}</h1>
            <i>{t('tagline')}</i>
          </span>
        </div>

        <div className="mast-actions">
          {accountsEnabled && account && <AccountMenu account={account} lang={lang} />}
          {accountsEnabled && !account && (
            <button className="btn btn-quiet" onClick={() => setPanel('login')}>
              <span className="wide-only">{t('acct_open')}</span>
              <span className="narrow-only">{t('acct_open_short')}</span>
            </button>
          )}
          <button
            className="btn btn-quiet"
            onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
            aria-label={lang === 'he' ? 'Switch to English' : 'עבור לעברית'}
          >
            {lang === 'he' ? 'EN' : 'עב'}
          </button>
        </div>
      </div>
      {panel && <AccountPanel lang={lang} mode={panel} onClose={() => setPanel(null)} />}
    </header>
  );

  /**
   * ⚠️ The landing page is the one screen that is NOT inside the reading
   * column: its grounds run the full width of the window, and a 46rem wrapper
   * would cut every band in half. Everything past it is a form, and a form
   * belongs in a column.
   */
  /**
   * ⭐ The answer is a PAGE, not a column. The road is the main body and the
   * things he must keep in mind while walking it — the clocks, the standing
   * conditions — sit beside it and stay visible as he scrolls. Her note after
   * walking the finished road: "it's just a long list of things to do".
   */
  if (screen === 'roadmap' && result && !result.blocked) {
    return (
      <>
        {header}

        {/**
          * ⭐ THE ANSWER OPENS ON A BAND, 23.9. The founder, walking the finished
          * flow: the landing page has colour and "the roadmap screen and also
          * the other are a little too pail". The title, the progress and the
          * print stamp used to sit on plain paper inside the reading column,
          * which is where the pale stretch began. They now sit on the warm
          * ground the landing page opens its sections on, full width, so the
          * answer starts the way the site starts.
          *
          * ⚠️ OUTSIDE .answer on purpose. The band is a ground and a ground
          * runs the width of the window; inside a 78rem column it would be a
          * tinted box, which is the thing it was built to replace.
          */}
        <section className="screen-band">
          <div className="screen-band-in">
            <p className="kicker">{t('band_kicker_roadmap')}</p>
            <h2>{t('roadmap_title')}</h2>

            {/* ⭐ Printed at the top of the sheet and nowhere else. A roadmap
                carried into an office on paper is a roadmap frozen on the day
                it was printed, and the procedures behind it keep moving. The
                date is the reader's own way of knowing how much to trust it. */}
            <p className="print-only print-stamp">
              {t('printed_on')}{' '}
              <span className="num">{new Date().toISOString().slice(0, 10)}</span> ·{' '}
              {t('printed_note')}
            </p>
            <div className="answer-progress">
              <span>
                <span className="num">{result.roadmap.filter((s) => s.state === 'done').length}</span>{' '}
                {t('progress')} {t('of')} <span className="num">{result.roadmap.length}</span>{' '}
                {t('steps_count')}
              </span>
              <div className="road-progress" aria-hidden="true">
                <span
                  style={{
                    width: `${(result.roadmap.filter((s) => s.state === 'done').length / Math.max(result.roadmap.length, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="answer">

          {/**
            * ⭐ The numbers that decide his week, her ask 22.9. Four at most,
            * and each one is something he would otherwise have to work out by
            * reading the whole page. A tile that merely counts something is
            * decoration and does not belong here.
            *
            * ⚠️ Every figure is read off the engine's own result. Nothing here
            * is computed a second way, because a figure that disagrees with the
            * road underneath it destroys the trust the road is built on.
            */}
          {(() => {
            const doneSteps = result.roadmap.filter((x) => x.state === 'done').length;
            const running = result.clocks
              .filter((c) => c.status === 'running' && typeof c.days_left === 'number')
              .sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0))[0];
            const expired = result.clocks.find((c) => c.status === 'expired');
            const r = result.readiness;
            const problems = r ? r.missing.length + r.mismatched.length : 0;

            return (
              <div className="figures">
                <div className={`figure${result.roadmap.length - doneSteps > 0 ? ' figure-now' : ''}`}>
                  <b className="num">{result.roadmap.length - doneSteps}</b>
                  <span>{t('fig_steps_left')}</span>
                  <small>
                    {t('fig_of')} <span className="num">{result.roadmap.length}</span>
                  </small>
                </div>

                <div className={`figure${expired ? ' figure-bad' : running && (running.days_left ?? 0) < 60 ? ' figure-now' : ''}`}>
                  {running ? (
                    <>
                      <b className="num">{running.days_left}</b>
                      <span>
                        {t('fig_days_left')} · {pick(running.clock.name, lang)}
                      </span>
                      {running.deadline && <small className="num">{running.deadline}</small>}
                    </>
                  ) : expired ? (
                    <>
                      <b>—</b>
                      <span>{pick(expired.clock.name, lang)}</span>
                      <small>{t('expired')}</small>
                    </>
                  ) : (
                    <>
                      <b>—</b>
                      <span>{t('fig_no_clock')}</span>
                    </>
                  )}
                </div>

                <div className={`figure${r && r.ready.length > 0 ? ' figure-good' : ''}`}>
                  <b className="num">{r ? r.ready.length : 0}</b>
                  <span>{t('fig_docs_ok')}</span>
                </div>

                <div className={`figure${problems > 0 ? ' figure-bad' : ''}`}>
                  <b className="num">{problems}</b>
                  <span>{t('fig_docs_problem')}</span>
                  <small>{t('fig_problem_note')}</small>
                </div>
              </div>
            );
          })()}

          {failure}

          {/* ⚠️ Said out loud, quietly. Ticking a step re-runs the whole
              engine, so the numbers and the road change a moment after he
              presses — and until M5 nothing on the screen admitted that
              anything was happening. */}
          {busy && (
            <p className="working" role="status">
              <span className="working-dot" aria-hidden="true" />
              {t('updating_road')}
            </p>
          )}

          <div className="answer-cols" aria-busy={busy}>
            {/* ⭐ ONE orchestrated reveal, on the screen where the answer
                arrives, and nothing else in the product moves. */}
            <div className="answer-main reveal">
              {/* ⭐ ABOVE EVERYTHING, 23.9. If two of his answers disagree then
                  the notices, the report and the road below are all built on
                  one of them, and he has to be able to see that before he
                  believes any of it. Quiet, because it is a doubt about an
                  answer and not a fact about his case. */}
              <Warnings warnings={result.warnings} lang={lang} />
              {/* ⚠️ Above the road. A roadmap built on a lapsed visa describes
                  a process he cannot currently start. */}
              <Urgent issues={result.urgent} lang={lang} />
              {/* ⭐ Whether what he is CARRYING will work, and the one thing to
                  do next. The road is the detail under it. */}
              <Readiness result={result} lang={lang} />
              <Roadmap result={result} lang={lang} onToggle={toggleStep} pending={pendingStep} />

              {/* ⭐ The paper sheet was built in M1 and had no door. This is
                  the door. It is the product's own thesis — they walk into an
                  office where a phone is no use — so it is a real offer on
                  the page, not something to be discovered through Ctrl+P. */}
              <div className="answer-actions">
                <button className="btn btn-quiet" onClick={() => window.print()}>
                  {t('print_page')}
                </button>
                <button className="btn btn-quiet" onClick={restart}>
                  {t('start_over')}
                </button>
              </div>
            </div>

            <aside className="answer-side">
              <RoadSide result={result} lang={lang} />
            </aside>
          </div>

          {/**
            * ⭐ Her call, 22.9: this becomes a chat about his own case, so the
            * way in is built now and the panel behind it does the one thing it
            * can do today — say the finished answer in plain words.
            *
            * ⚠️ It REPLACES nothing, and nothing depends on it. The road and
            * the report are complete before it is ever opened, and they stay
            * exactly as they are if the model is switched off or wrong.
            */}
          {!asking && (
            <button type="button" className="ask-fab" onClick={() => setAsking(true)}>
              <svg className="seal" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="18.25" stroke="currentColor" strokeWidth="2" />
                <circle cx="20" cy="20" r="5" fill="var(--amber)" />
              </svg>
              {t('ask_open')}
            </button>
          )}

          {asking && (
            <aside className="ask-panel" role="dialog" aria-label={t('ask_open')}>
              <div className="ask-head">
                <h2>{t('ask_open')}</h2>
                <button
                  type="button"
                  className="ask-close"
                  aria-label={t('ask_close')}
                  onClick={() => setAsking(false)}
                >
                  ×
                </button>
              </div>
              <p className="ask-soon">{t('ask_soon')}</p>
              <PlainWords
                profile={answers ? { ...answers, completed_steps: done } : null}
                lang={lang}
                available={plainLanguage}
              />
            </aside>
          )}
        </div>
      </>
    );
  }

  if (screen === 'welcome') {
    return (
      <>
        {header}
        <Welcome processes={processes} lang={lang} onStart={() => setScreen('intake')} />
      </>
    );
  }

  /**
   * ⭐ EVERY SCREEN OF THE FLOW IS WIDE, 23.9. אבחון and מסמכים went first;
   * the intake followed on her third note, and the intake was the one she had
   * meant all along: "the page with that question where the user says what he
   * has and what visa he is holding looks like a list. I don't like it."
   *
   * ⚠️ The first draft argued the opposite here — that fourteen answers to one question
   * is what a list is FOR. She overruled it, and she is right about this
   * audience: a column of fourteen near-identical rows is the government form
   * the whole product exists to not be. Across the page they are a board of
   * answers he can see all of at once and pick from, which is what choosing
   * your own status actually is.
   */
  const wide = screen === 'intake' || screen === 'diagnosis' || screen === 'documents';

  return (
    <>
      {header}

      {/**
        * ⭐ THE SAME BAND ON THE QUESTION SCREENS, 23.9. They were a column of
        * white cards on warm paper, opening on a grey line of explanation — the
        * other half of her "too pail". The band carries the product's voice, the
        * line about what this is and does not do, and the rail saying where he
        * is in the flow, all on the warm ground, so a screen of questions starts
        * like a section of the landing page.
        *
        * ⚠️ The masthead moved out of .page at the same time. It was inside the
        * 46rem reading column here and full width on every other screen, so the
        * wordmark jumped sideways the moment a person pressed "start".
        */}
      <section className={`screen-band${wide ? '' : ' screen-band-form'}`}>
        <div className="screen-band-in">
          <p className="kicker">{t(`band_kicker_${screen}` as keyof typeof UI)}</p>

          {screen === 'intake' && (
            <p className="screen-band-lede">
              {t('intro')} <strong>{t('privacy')}</strong>
            </p>
          )}

          {/* ⭐ Where you are, in four marks. Added 31.8.
              The flow is intake → אבחון → מסמכים → הדרך, and until now a person
              could not tell which of the four he was on, or how many were left.
              For an audience the PRD describes as "כבר נדחו, כבר בזבזו יום עבודה",
              an unmarked multi-step form is its own small anxiety.
              Marks rather than numbered labels, so it stays legible at 320px and
              mirrors correctly in both directions.
              ⚠️ It sits at the FOOT of the band, against the form it measures. */}
          <ol className="progress" aria-label={t('progress_label')}>
            {SCREENS.map((s, i) => {
              const at = SCREENS.indexOf(screen);
              const state = i < at ? 'done' : i === at ? 'here' : 'ahead';
              return (
                <li key={s} data-state={state} aria-current={state === 'here' ? 'step' : undefined} />
              );
            })}
          </ol>
        </div>
      </section>

      <div className={`page stack${wide ? ` page-wide page-${screen}` : ''}`}>
      {failure}

      {/**
        * ⭐ The first screen of the product, on a slow connection, used to be
        * a headline and then nothing: the visa list comes from the API, and
        * until it lands there is no form to draw. Blank space reads as broken,
        * and this audience has been failed by enough websites already.
        *
        * ⚠️ The shapes are the shapes of the real question: a heading, a line
        * of explanation, and a list of answers to tap, each the height of a
        * real one. Photographed against the real form (evidence/m5-waiting):
        * the list that lands is longer than the list drawn, so the card grows
        * — downward, under everything he was already reading, which does not
        * move. An earlier version drew two short bars and the page tripled in
        * height when the questions arrived.
        */}
      {screen === 'intake' && !statuses && !error && (
        <div className="card stack-sm skel-form" aria-busy="true" aria-live="polite">
          <p className="muted small">{t('loading_form')}</p>
          <span className="skel skel-title" />
          <span className="skel skel-line" />
          <div className="options" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span className="skel skel-option" key={i} />
            ))}
          </div>
        </div>
      )}

      {screen === 'intake' && statuses && (
        <Intake
          lang={lang}
          statuses={statuses.statuses}
          licenseClasses={statuses.license_classes}
          onSubmit={submit}
          busy={busy}
        />
      )}

      {screen === 'diagnosis' && result && (
        <Diagnosis
          result={result}
          lang={lang}
          onConfirm={() => setScreen('documents')}
          onBack={restart}
        />
      )}

      {/* ⭐ The engine decides which document sections to ask about. This was
          `converting={track === 'conversion'}` — the website's last piece of
          domain knowledge, and the reason a returning Israeli resident was
          asked for a visa and an 89 he does not have. Found by the founder, 31.8. */}
      {screen === 'documents' && result && (
        <Documents
          lang={lang}
          questions={result.diagnosis.document_questions}
          onSubmit={submitDocuments}
          onSkip={() => setScreen('roadmap')}
          busy={busy}
        />
      )}

      {screen === 'roadmap' && result && result.blocked && (
        <Blocked result={result} lang={lang} onBack={restart} />
      )}
      </div>
    </>
  );
}
