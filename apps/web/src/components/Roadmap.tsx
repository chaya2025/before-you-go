import { useState } from 'react';
import type { Result, RoadmapStep, ClockState, CertaintyMark } from '@byg/engine';
import { CERTAINTY_META, attributions } from '@byg/engine';
import { UI, pick, type Lang } from '../i18n';

/**
 * ============================================================================
 * The roadmap
 * ============================================================================
 *
 * Renders exactly what the engine returned. It computes nothing.
 *
 * Carries the corrections from 26.8, all of them the founder's:
 *   · ONE fact, one line. Sources folded behind a click, not printed five times
 *   · full map always visible, future steps dimmed, NEVER hidden
 *   · ⭐ start-now steps float to the top
 *   · uncertain steps stay, naming the question that would settle them
 *   · every certainty chip carries a symbol AND a word, never colour alone
 */

/** ⭐ "ודאות היא אלמנט עיצובי... היושרה של המוצר חייבת להיראות, לא רק להיכתב." */
function Chip({ mark, lang }: { mark: CertaintyMark; lang: Lang }) {
  const meta = CERTAINTY_META[mark];
  return (
    <span className={`chip chip-${mark}`}>
      <span aria-hidden="true">{meta.symbol}</span>
      <span>{lang === 'he' ? meta.he : meta.en}</span>
    </span>
  );
}

function Clock({ clock, lang }: { clock: ClockState; lang: Lang }) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const name = pick(clock.clock.name, lang);

  let detail: React.ReactNode;
  if (clock.status === 'expired') {
    detail = (
      <>
        <strong style={{ color: 'var(--uncertain)' }}>{t('expired')}</strong>
        {/* ⭐ The whole point of the two-clock split: an expired driving clock
            is NOT the end of the conversion window, and it says so. */}
        <div className="small">{pick(clock.clock.on_expiry, lang)}</div>
      </>
    );
  } else if (clock.status === 'running') {
    detail = (
      <strong style={{ color: clock.warning ? 'var(--amber)' : 'var(--ink)' }}>
        <span className="num">{clock.days_left}</span> {t('days_left')}
      </strong>
    );
  } else if (clock.status === 'unknown') {
    detail = <span className="muted small">{t('unknown_clock')}</span>;
  } else {
    detail = <span className="muted small">{t('not_started_clock')}</span>;
  }

  return (
    <div style={{ paddingBlock: 'var(--gap-xs)' }}>
      <div>{name}</div>
      {detail}
      {clock.deadline && (
        <div className="muted small num">{clock.deadline}</div>
      )}
    </div>
  );
}

function Step({ item, lang }: { item: RoadmapStep; lang: Lang }) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const [open, setOpen] = useState(false);
  const { step } = item;

  const dimmed = item.state === 'later' || item.state === 'waiting_on';
  const shown = attributions(step.evidence);

  // The count by mark: what kind of evidence is behind this, at a glance,
  // without reading five near-identical lines.
  const counts = new Map<CertaintyMark, number>();
  for (const part of step.evidence) {
    counts.set(part.certainty, (counts.get(part.certainty) ?? 0) + 1);
  }

  return (
    <article
      className="card stack-sm"
      style={{
        opacity: dimmed ? 0.62 : 1,
        // ⭐ Amber, and only amber, marks where you are standing.
        borderInlineStartWidth: item.state === 'do_now' ? '4px' : '1px',
        borderInlineStartColor: item.state === 'do_now' ? 'var(--amber)' : 'var(--line)',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--gap-sm)', alignItems: 'baseline' }}>
        <span aria-hidden="true">
          {item.state === 'done' ? '✅' : item.state === 'uncertain' ? '❔' : item.state === 'waiting_on' ? '⏸️' : '•'}
        </span>
        <h3 style={{ flex: 1 }}>{pick(step.title, lang)}</h3>
      </div>

      {pick(step.action, lang)
        .split('\n')
        .filter(Boolean)
        .map((line, i) => (
          <p key={i}>{line}</p>
        ))}

      {/* Clarifications that apply to HIM. The 89 explanation used to appear
          for everyone, including people who will never hold one. */}
      {item.notes.map((n, i) => (
        <p key={i} className="small">
          {pick(n, lang)}
        </p>
      ))}

      {item.start_now && (
        <p style={{ color: 'var(--amber)', fontWeight: 500 }}>
          ⭐ {t('start_now')} — <span className="muted">{t('start_now_why')}</span>
        </p>
      )}

      {item.must_precede && (
        <p style={{ color: 'var(--amber)', fontWeight: 500 }}>
          ⭐ {t('before')} <span className="ltr">{item.must_precede}</span>
        </p>
      )}

      {item.waiting_on.length > 0 && (
        <p className="muted small">
          ⏸ {t('waiting_for')}: <span className="ltr">{item.waiting_on.join(', ')}</span>
        </p>
      )}

      {/* ⭐ the founder's rule: thin evidence gets advice with its recovery built in,
          never a hedge. "לך בלי תור, ואם דוחים — קבע תור באותו רגע." */}
      {step.fallback && <p>↩ {pick(step.fallback, lang)}</p>}

      {/* An unplaceable step stays, and says which answer would settle it. */}
      {item.applies === 'unknown' && (
        <p className="small" style={{ color: 'var(--unchecked)' }}>
          ❔ {t('uncertain_step')} — {t('uncertain_answer')}:{' '}
          <span className="ltr">{item.missing_answers.join(', ')}</span>
        </p>
      )}

      {item.checks_first.map((c) => (
        <p key={c.id} className="small">
          🔎 {t('check_first')}: {pick(c.name, lang)}
        </p>
      ))}

      {/* ⚠️ item.checklist, not step.checklist — the engine has already removed
          the lines that do not apply to this person. Rendering the raw list is
          how a citizen ended up being asked about his 89 document. */}
      {item.checklist.map((c, i) => (
        <p key={i} className="small">
          ☐ {pick(c, lang)}
        </p>
      ))}

      {/* What to physically carry, resolved against who he actually is. */}
      {item.documents.length > 0 && (
        <p className="small">
          🎒 {t('bring')}:{' '}
          {item.documents.map((d) => pick(d.name, lang)).join(' · ')}
        </p>
      )}

      {step.cost?.amount_ils !== undefined && (
        <p className="small">
          ₪ <span className="num">{step.cost.amount_ils}
          {step.cost.max_ils ? `–${step.cost.max_ils}` : ''}</span>
          {step.cost.note ? ` · ${pick(step.cost.note, lang)}` : ''}
        </p>
      )}

      {step.links.map((l) => (
        <p key={l.url} className="small">
          🔗{' '}
          <a href={l.url} target="_blank" rel="noreferrer">
            {pick(l.label, lang)}
          </a>
        </p>
      ))}

      {/* ── the sources, folded ──────────────────────────────────────────
          Nothing is hidden — principle 20 — the sources just stopped
          shouting over the instruction. */}
      <div className="stack-sm" style={{ borderBlockStart: '1px solid var(--line)', paddingBlockStart: 'var(--gap-sm)' }}>
        <button
          type="button"
          className="btn btn-quiet small"
          style={{ minHeight: 'auto', paddingBlock: '0.35rem' }}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          📎 <span className="num">{step.evidence.length}</span> {t('sources')}{' '}
          {[...counts.entries()].map(([mark, n]) => (
            <span key={mark} aria-hidden="true">
              {CERTAINTY_META[mark].symbol}
              {n > 1 ? `×${n}` : ''}{' '}
            </span>
          ))}
          · {open ? t('hide_sources') : t('show_sources')}
        </button>

        {open && (
          <div className="stack-sm small">
            {[...shown.official, ...shown.reported].map((a, i) => (
              <div key={i}>
                <Chip mark={a.mark} lang={lang} />{' '}
                {a.lead_in[lang] ? `${a.lead_in[lang]}: ` : ''}
                {a.claim}
                {a.citation && <div className="muted">{a.citation}</div>}
                {a.url && (
                  <div>
                    <a className="ltr" href={a.url} target="_blank" rel="noreferrer">
                      {a.url}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function Roadmap({ result, lang }: { result: Result; lang: Lang }) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const doneCount = result.roadmap.filter((s) => s.state === 'done').length;

  return (
    <div className="stack">
      {result.clocks.length > 0 && (
        <section className="card stack-sm">
          <h2>{t('clocks_title')}</h2>
          {result.clocks.map((c) => (
            <Clock key={c.clock.id} clock={c} lang={lang} />
          ))}
        </section>
      )}

      {result.standing_conditions.length > 0 && (
        <section className="card stack-sm" style={{ borderInlineStartWidth: '4px', borderInlineStartColor: 'var(--uncertain)' }}>
          <h2>⚠️ {t('standing_title')}</h2>
          <p className="muted small">{t('standing_note')}</p>
          {result.standing_conditions.map((c) => (
            <details key={c.id}>
              <summary>{pick(c.name, lang)}</summary>
              <p className="small">{pick(c.consequence_if_invalid, lang)}</p>
              <p className="small">
                <strong>{pick(c.remedy, lang)}</strong>
              </p>
            </details>
          ))}
        </section>
      )}

      <div>
        <h2>{t('roadmap_title')}</h2>
        {/* ⭐ "התקדמות נמדדת קדימה. מוצג כמה כבר הושלם, לא כמה נותר." */}
        <p className="muted small">
          <span className="num">{result.roadmap.length}</span> {t('steps_count')}
          {doneCount > 0 && (
            <>
              {' · '}
              <span className="num">{doneCount}</span> {t('done')}
            </>
          )}
        </p>
      </div>

      <div className="stack">
        {result.roadmap.map((item) => (
          <Step key={item.step.id} item={item} lang={lang} />
        ))}
      </div>
    </div>
  );
}
