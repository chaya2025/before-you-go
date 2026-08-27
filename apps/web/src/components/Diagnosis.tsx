import type { Result } from '@byg/engine';
import { CERTAINTY_META } from '@byg/engine';
import { UI, pick, type Lang } from '../i18n';
import { Urgent } from './Urgent';

/**
 * ============================================================================
 * The diagnosis summary, and the blocked screen
 * ============================================================================
 *
 * F1 step 17 marks the summary חובה, and gives the reason:
 * "טעות באבחון מייצרת רודמאפ שגוי לגמרי." So the conclusion is shown, with a
 * way to go back and correct it, BEFORE any roadmap appears.
 */

export function Diagnosis({
  result,
  lang,
  onConfirm,
  onBack,
}: {
  result: Result;
  lang: Lang;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const d = result.diagnosis;

  const windowClock = result.clocks.find((c) => c.clock.id === 'clock.conversion_window');

  const trackLabel =
    d.track === 'conversion' ? t('track_conversion') : d.track === 'from_zero' ? t('track_from_zero') : '—';

  return (
    <div className="stack">
      <section className="card stack-sm">
        <h2>{t('diagnosis_title')}</h2>
        <p className="muted small">{t('diagnosis_check')}</p>

        <dl className="stack-sm" style={{ margin: 0 }}>
          <Row label={t('d_track')} value={trackLabel} />
          <Row label={t('d_category')} value={d.nohal_category} mono />
          <Row
            label={t('d_ceiling')}
            value={
              d.grade_ceiling ? (
                <span className="num">
                  {d.grade_ceiling.from}–{d.grade_ceiling.to}
                </span>
              ) : (
                '—'
              )
            }
          />
          <Row
            label={t('d_tz')}
            value={d.has_teudat_zehut === true ? t('yes') : d.has_teudat_zehut === false ? t('no') : t('unsure')}
          />

          {/* ⭐ Everything below was missing until 27.8, which is why the
              summary felt disconnected from the road underneath it. These are
              precisely the conclusions that change what the roadmap contains. */}
          {d.requested_class !== 'unknown' && (
            <Row
              label={t('d_requested')}
              value={
                <span style={{ color: d.requested_class_status === 'above' ? 'var(--uncertain)' : undefined }}>
                  <span className="ltr">{d.requested_class}</span>
                  {d.requested_class_status === 'above' ? ' ⚠️' : ''}
                </span>
              }
            />
          )}

          {d.track === 'conversion' && (
            <Row
              label={t('d_exemption')}
              value={
                d.exemption === 'exempt'
                  ? t('exempt_yes')
                  : d.exemption === 'tests_required'
                    ? t('exempt_no')
                    : t('exempt_unknown')
              }
            />
          )}

          {/* The window, read off the clock rather than recomputed, so the
              summary can never disagree with the countdown on the next screen. */}
          {windowClock?.deadline && (
            <Row
              label={t('d_window')}
              value={
                <span className="num" style={{ color: windowClock.status === 'expired' ? 'var(--uncertain)' : undefined }}>
                  {windowClock.deadline}
                </span>
              }
            />
          )}
        </dl>

        {/* ⚠️ Status-specific traps — the ב/2 short-visa one lives here, and the
            א/5 note that having a teudat zehut does NOT lift the grade ceiling. */}
        {d.caveat && (
          <p style={{ borderInlineStart: '3px solid var(--amber)', paddingInlineStart: 'var(--gap-sm)' }}>
            {pick(d.caveat, lang)}
          </p>
        )}

        {d.extra_requirements.map((r, i) => (
          <p key={i} className="small">
            • {pick(r, lang)}
          </p>
        ))}
      </section>

      {result.urgent.length > 0 && (
        <div className="stack-sm">
          <h3>{t('urgent_first')}</h3>
          <Urgent issues={result.urgent} lang={lang} />
        </div>
      )}

      {result.diagnosis.unanswered.length > 0 && (
        <p className="muted small">
          {t('d_open_questions')}: <span className="ltr">{result.diagnosis.unanswered.join(', ')}</span>
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={onConfirm}>
          {t('looks_right')}
        </button>
        <button className="btn btn-quiet" onClick={onBack}>
          {t('back')}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--gap-sm)', justifyContent: 'space-between' }}>
      <dt className="muted">{label}</dt>
      <dd style={{ margin: 0, fontWeight: 500 }} className={mono ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}

/**
 * ⚠️ "לעולם לא מסך דחייה יבש. חסם מוצג עם מקורו, תאריכו ומצבו — ואף פעם בלי
 * דרך פעולה כלשהי."
 *
 * There is exactly one blocker in this system. A person who hits it must leave
 * knowing what stopped him, on whose authority, that it is being fought over
 * right now, and who to talk to.
 */
export function Blocked({
  result,
  lang,
  onBack,
}: {
  result: Result;
  lang: Lang;
  onBack: () => void;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const b = result.blocked!;
  const days = b.days_to_expected_resolution;

  return (
    <div className="stack">
      <section
        className="card stack-sm"
        style={{ borderInlineStartWidth: '4px', borderInlineStartColor: 'var(--in-litigation)' }}
      >
        <h2>{pick(b.blocker.title, lang)}</h2>

        {pick(b.blocker.explanation, lang)
          .split('\n')
          .filter(Boolean)
          .map((line, i) => (
            <p key={i}>{line}</p>
          ))}

        {days !== null && (
          <p style={{ fontWeight: 500 }}>
            📅{' '}
            {days >= 0 ? (
              <>
                {t('blocked_expected')}:{' '}
                <span className="num">{b.blocker.expected_resolution_at}</span>
              </>
            ) : (
              t('blocked_passed')
            )}
          </p>
        )}
      </section>

      {b.blocker.referrals.length > 0 && (
        <section className="card stack-sm">
          <h3>{t('blocked_orgs')}</h3>
          {b.blocker.referrals.map((r) => (
            <p key={r.url ?? r.name.he}>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer">
                  {pick(r.name, lang)}
                </a>
              ) : (
                pick(r.name, lang)
              )}
            </p>
          ))}
        </section>
      )}

      <section className="card stack-sm small">
        <h3>{t('sources')}</h3>
        {b.blocker.evidence.map((part, i) => (
          <div key={i}>
            <span className={`chip chip-${part.certainty}`}>
              <span aria-hidden="true">{CERTAINTY_META[part.certainty].symbol}</span>
              <span>{lang === 'he' ? CERTAINTY_META[part.certainty].he : CERTAINTY_META[part.certainty].en}</span>
            </span>{' '}
            {part.claim}
            {part.citation && <div className="muted">{part.citation}</div>}
          </div>
        ))}
      </section>

      <button className="btn btn-quiet" onClick={onBack}>
        {t('back')}
      </button>
    </div>
  );
}
