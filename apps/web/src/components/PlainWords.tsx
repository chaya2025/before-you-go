import { useState } from 'react';
import { fetchExplanation, type Explanation } from '../api';
import { UI, pick, type Lang } from '../i18n';

/**
 * ============================================================================
 * In plain words — the finished answer, said by the language model
 * ============================================================================
 *
 * ⭐ HARD RULE 3 ON SCREEN. Everything below this panel — the notices, the
 * readiness report, the road — is decided by the engine and is already
 * complete. This adds nothing to it. It re-says it.
 *
 * ⚠️ AND IT NEVER REPLACES ANYTHING. That is the strongest guarantee available
 * on a screen: the deterministic answer stays exactly where it was, and this
 * sits above it as an orientation. If the model ever wrote something wrong, the
 * real steps are still right there, unedited, one scroll down.
 *
 * ⚠️ ASKED FOR, never automatic. It is the only paid call in the product, and a
 * person who does not want it should not spend anything. It also means nobody's
 * answer is sent anywhere unless they press the button — which, for a
 * population uploading passport details, is the right default even though the
 * payload carries no identifiers.
 *
 * ⚠️ The source is SHOWN. A person reading a government answer is entitled to
 * know which sentences a language model wrote and which were quoted from a
 * procedure.
 */
export function PlainWords({
  profile,
  lang,
  available,
}: {
  profile: Record<string, unknown> | null;
  lang: Lang;
  available: boolean;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const [state, setState] = useState<Explanation | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!profile) return null;

  async function ask() {
    if (!profile) return;
    setBusy(true);
    setFailed(false);
    try {
      setState(await fetchExplanation(profile, lang));
    } catch {
      // ⚠️ Only a transport failure reaches here — a model failure comes back
      // as a normal 200 carrying the deterministic text.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="letter">
      <h2>{t('plain_title')}</h2>

      {!state && !failed && (
        <>
          <p className="muted small">{available ? t('plain_intro') : t('plain_offline')}</p>
          <button className="btn btn-quiet" disabled={busy} onClick={ask}>
            {busy ? t('loading') : t('plain_ask')}
          </button>
        </>
      )}

      {failed && <p className="small">{t('error_offline')}</p>}

      {state && (
        <>
          {state.text.split('\n').filter(Boolean).map((line, i) => (
            <p key={i}>{line}</p>
          ))}

          {/* ⚠️ Never a silent switch. The person is told, in one quiet line,
              who wrote what he just read. */}
          <p className="letter-by">
            {state.source === 'model' ? t('plain_by_model') : t('plain_by_rules')}
          </p>
        </>
      )}
    </section>
  );
}
