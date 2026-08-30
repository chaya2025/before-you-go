import { useEffect, useState } from 'react';
import type { Result } from '@byg/engine';
import { fetchStatuses, fetchReadiness, ValidationError, type StatusesResponse } from './api';
import { UI, pick, dirFor, type Lang } from './i18n';
import { Intake, type Answers } from './components/Intake';
import { Diagnosis, Blocked } from './components/Diagnosis';
import { Documents } from './components/Documents';
import { Roadmap } from './components/Roadmap';
import { Urgent } from './components/Urgent';

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

type Screen = 'intake' | 'diagnosis' | 'documents' | 'roadmap';

export function App() {
  const [lang, setLang] = useState<Lang>('he');
  const [screen, setScreen] = useState<Screen>('intake');
  const [statuses, setStatuses] = useState<StatusesResponse | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  /** Kept so ticking a step can re-run the engine with the same answers. */
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setScreen('intake');
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
            <>
              {/* ⚠️ Above the road, not beside it. A roadmap built on a lapsed
                  visa describes a process he cannot currently start. */}
              <Urgent issues={result.urgent} lang={lang} />
              <Roadmap result={result} lang={lang} onToggle={toggleStep} />
              <button className="btn btn-quiet" onClick={restart}>
                {t('start_over')}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
