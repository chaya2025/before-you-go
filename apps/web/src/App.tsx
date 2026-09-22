import { useEffect, useState } from 'react';
import type { Result, Process } from '@byg/engine';
import { fetchStatuses, fetchReadiness, fetchCapabilities, fetchProcesses, ValidationError, type StatusesResponse } from './api';
import { UI, pick, dirFor, type Lang } from './i18n';
import { Intake, type Answers } from './components/Intake';
import { Diagnosis, Blocked } from './components/Diagnosis';
import { Documents } from './components/Documents';
import { Roadmap } from './components/Roadmap';
import { Urgent } from './components/Urgent';
import { Readiness } from './components/Readiness';
import { PlainWords } from './components/PlainWords';
import { Welcome } from './components/Welcome';
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
 * ⭐ Documents was added 30.8, and its position is Chaya's:
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
  const [error, setError] = useState<string | null>(null);
  /** Whether the plain-language layer is switched on where this is deployed. */
  const [plainLanguage, setPlainLanguage] = useState(false);
  /** What the system can check readiness for. Served, never hardcoded here. */
  const [processes, setProcesses] = useState<Process[]>([]);

  const t = (k: keyof typeof UI) => pick(UI[k], lang);

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
   * ticking. Chaya's design — "I want the system to realise where the user
   * actually is."
   */
  async function toggleStep(id: string, isDone: boolean) {
    if (!answers) return;
    const next = isDone ? [...done, id] : done.filter((x) => x !== id);
    setDone(next);
    setBusy(true);
    try {
      setResult(await fetchReadiness({ ...answers, completed_steps: next }));
    } catch {
      setError(t('error_offline'));
    } finally {
      setBusy(false);
    }
  }

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

        <button
          className="btn btn-quiet"
          onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
          aria-label={lang === 'he' ? 'Switch to English' : 'עבור לעברית'}
        >
          {lang === 'he' ? 'EN' : 'עב'}
        </button>
      </div>
    </header>
  );

  /**
   * ⚠️ The landing page is the one screen that is NOT inside the reading
   * column: its grounds run the full width of the window, and a 46rem wrapper
   * would cut every band in half. Everything past it is a form, and a form
   * belongs in a column.
   */
  if (screen === 'welcome') {
    return (
      <>
        {header}
        <Welcome processes={processes} lang={lang} onStart={() => setScreen('intake')} />
      </>
    );
  }

  return (
    <div className="page stack">
      {header}

      {/* ⭐ Where you are, in four marks. Added 31.8.
          The flow is intake → אבחון → מסמכים → הדרך, and until now a person
          could not tell which of the four he was on, or how many were left.
          For an audience the PRD describes as "כבר נדחו, כבר בזבזו יום עבודה",
          an unmarked multi-step form is its own small anxiety.
          Marks rather than numbered labels, so it stays legible at 320px and
          mirrors correctly in both directions. */}
      <ol className="progress" aria-label={t('progress_label')}>
        {SCREENS.map((s, i) => {
          const at = SCREENS.indexOf(screen);
          const state = i < at ? 'done' : i === at ? 'here' : 'ahead';
          return (
            <li key={s} data-state={state} aria-current={state === 'here' ? 'step' : undefined} />
          );
        })}
      </ol>

      {screen === 'intake' && (
        <p className="muted">
          {t('intro')} <strong>{t('privacy')}</strong>
        </p>
      )}

      {error && (
        <div
          className="card"
          style={{ borderInlineStartWidth: '4px', borderInlineStartColor: 'var(--uncertain)' }}
          role="alert"
        >
          <h3>{t('error_title')}</h3>
          <p className="small">{error}</p>
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
          asked for a visa and an 89 he does not have. Found by Chaya, 31.8. */}
      {screen === 'documents' && result && (
        <Documents
          lang={lang}
          questions={result.diagnosis.document_questions}
          onSubmit={submitDocuments}
          onSkip={() => setScreen('roadmap')}
          busy={busy}
        />
      )}

      {screen === 'roadmap' && result && (
        <>
          {result.blocked ? (
            <Blocked result={result} lang={lang} onBack={restart} />
          ) : (
            /* ⭐ ONE orchestrated reveal, on the screen where the answer
               arrives, and nothing else in the product moves. This is the
               moment the person filled in the whole form for. Scattered
               animation elsewhere would make it read as a toy, and a tool for
               people who have already been failed by an office must not. */
            <div className="stack reveal">
              {/* ⭐ First, and it REPLACES nothing. If the model ever wrote
                  something wrong, every exact step is still below it. */}
              <PlainWords profile={answers ? { ...answers, completed_steps: done } : null} lang={lang} available={plainLanguage} />
              {/* ⚠️ Above the road, not beside it. A roadmap built on a lapsed
                  visa describes a process he cannot currently start. */}
              <Urgent issues={result.urgent} lang={lang} />
              {/* ⭐ Between the notices and the road. The notices say what is in
                  the way; this says whether what he is CARRYING will work, and
                  names the one thing to do next. The road is the detail under
                  it. */}
              <Readiness result={result} lang={lang} />
              <Roadmap result={result} lang={lang} onToggle={toggleStep} />
              <button className="btn btn-quiet" onClick={restart}>
                {t('start_over')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
