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

  /**
   * ⚠️ The direction of the whole document changes with the language, not just
   * the words. Hebrew right-to-left, English left-to-right, layout mirrored.
   * "כיווניות RTL מלאה מהיסוד, לא כשכבת תיקון."
   */
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
  }, [lang]);

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

  return (
    <div className="page stack">
      <header className="stack-sm">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--gap-sm)' }}>
          <div>
            {/* The logotype stands in for the mark, which the PRD says is not
                needed before launch: "נדרש לפני ההשקה, לא לפני ה-POC." */}
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: '0.55rem',
                  height: '0.55rem',
                  borderRadius: '50%',
                  background: 'var(--amber)',
                }}
              />
              <span className="ltr">{t('brand')}</span>
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              {t('tagline')}
            </p>
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

      {/* ⭐ Where you are, in four marks. Added 31.8.
          The flow is intake → אבחון → מסמכים → הדרך, and until now a person
          could not tell which of the four he was on, or how many were left.
          For an audience the PRD describes as "כבר נדחו, כבר בזבזו יום עבודה",
          an unmarked multi-step form is its own small anxiety.
          Marks rather than numbered labels, so it stays legible at 320px and
          mirrors correctly in both directions. */}
      {screen !== 'welcome' && (
      <ol className="progress" aria-label={t('progress_label')}>
        {SCREENS.map((s, i) => {
          const at = SCREENS.indexOf(screen);
          const state = i < at ? 'done' : i === at ? 'here' : 'ahead';
          return (
            <li key={s} data-state={state} aria-current={state === 'here' ? 'step' : undefined} />
          );
        })}
      </ol>
      )}

      {screen === 'welcome' && (
        <Welcome processes={processes} lang={lang} onStart={() => setScreen('intake')} />
      )}

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

      {screen === 'documents' && result && (
        <Documents
          lang={lang}
          converting={result.diagnosis.track === 'conversion'}
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
