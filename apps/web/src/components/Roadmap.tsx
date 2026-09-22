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

/**
 * The small marks beside a line of practical detail. Drawn rather than emoji:
 * an emoji is a different picture on every device, is read out as its own name
 * by a screen reader, and is the single fastest way to make a serious page
 * look improvised.
 */
const ICON = {
  bag: 'M8 7V6a4 4 0 118 0v1m-9 0h10a2 2 0 012 2v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z',
  coin: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-13v10m2.5-7.5H10.8a1.7 1.7 0 000 3.4h2.4a1.7 1.7 0 010 3.4H9.5',
  look: 'M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zm4.8 1.8L20 21',
  link: 'M10 13a4 4 0 005.7 0l2.6-2.6a4 4 0 10-5.7-5.7L11.5 6M14 11a4 4 0 00-5.7 0l-2.6 2.6a4 4 0 105.7 5.7L12.5 18',
  clip: 'M16.5 8.5l-6 6a2.5 2.5 0 003.5 3.5l6.5-6.5a4.5 4.5 0 10-6.4-6.4L6.5 12.2a6.5 6.5 0 009.2 9.2',
  wait: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-13.5V12l3 2',
} as const;

function Mark({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
        <strong className="clock-expired">{t('expired')}</strong>
        {/* ⭐ The whole point of the two-clock split: an expired driving clock
            is NOT the end of the conversion window, and it says so. */}
        <div className="small">{pick(clock.clock.on_expiry, lang)}</div>
      </>
    );
  } else if (clock.status === 'running') {
    detail = (
      <strong className={clock.warning ? 'clock-warning' : undefined}>
        <span className="num">{clock.days_left}</span> {t('days_left')}
      </strong>
    );
  } else if (clock.status === 'unknown') {
    detail = <span className="muted small">{t('unknown_clock')}</span>;
  } else {
    detail = <span className="muted small">{t('not_started_clock')}</span>;
  }

  return (
    <div className="clock-row">
      <div className="clock-name">{name}</div>
      {detail}
      {clock.deadline && <div className="muted small num">{clock.deadline}</div>}
    </div>
  );
}

function Step({
  item,
  lang,
  onToggle,
}: {
  item: RoadmapStep;
  lang: Lang;
  onToggle?: (id: string, done: boolean) => void;
}) {
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
      // ⭐ The marker on the spine reads this. Amber, and only amber, marks
      // where you are standing — now as a diamond ON the road rather than an
      // edge beside it, so it is findable without reading.
      data-state={item.state}
      className={`card stack-sm step${dimmed ? ' step-later' : ''}${item.state === 'done' ? ' step-done' : ''}`}
    >
      <div className="step-head">
        <h3>{pick(step.title, lang)}</h3>
        <span className={`step-state step-state-${item.state}`}>
          {t(`state_${item.state}` as keyof typeof UI)}
        </span>
      </div>

      {/* ⭐ Ticking a step re-runs the whole engine. That is what makes the map
          move with him instead of describing a stranger — and it is what starts
          the clocks that only exist once he is in a particular situation. */}
      {onToggle && (
        <label className="step-tick">
          <input
            type="checkbox"
            checked={item.state === 'done'}
            onChange={(e) => onToggle(step.id, e.target.checked)}
          />
          <span className="small muted">
            {item.state === 'done' ? t('marked_done') : t('mark_done')}
          </span>
        </label>
      )}

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
        <p className="flag">
          <span>
            <strong>{t('start_now')}</strong> — {t('start_now_why')}
          </span>
        </p>
      )}

      {item.must_precede && (
        <p className="flag">
          <span>
            {t('before')} <span className="ltr">{item.must_precede}</span>
          </span>
        </p>
      )}

      {item.waiting_on.length > 0 && (
        <p className="meta-row">
          <Mark d={ICON.wait} />
          <span>
            {t('waiting_for')}: <span className="ltr">{item.waiting_on.join(', ')}</span>
          </span>
        </p>
      )}

      {/* ⭐ the founder's rule: thin evidence gets advice with its recovery built in,
          never a hedge. "לך בלי תור, ואם דוחים — קבע תור באותו רגע." */}
      {step.fallback && <p className="flag flag-quiet"><span>{pick(step.fallback, lang)}</span></p>}

      {/* An unplaceable step stays, and says which answer would settle it. */}
      {item.applies === 'unknown' && (
        <p className="small" style={{ color: 'var(--unchecked)' }}>
          ❔ {t('uncertain_step')} — {t('uncertain_answer')}:{' '}
          <span className="ltr">{item.missing_answers.join(', ')}</span>
        </p>
      )}

      {item.checks_first.map((c) => (
        <p key={c.id} className="meta-row">
          <Mark d={ICON.look} />
          <span>
            {t('check_first')}: {pick(c.name, lang)}
          </span>
        </p>
      ))}

      {/* ⚠️ item.checklist, not step.checklist — the engine has already removed
          the lines that do not apply to this person. Rendering the raw list is
          how a citizen ended up being asked about his 89 document. */}
      {item.checklist.length > 0 && (
        <ul className="step-checklist">
          {item.checklist.map((c, i) => (
            <li key={i}>
              <span>{pick(c, lang)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* What to physically carry, resolved against who he actually is. */}
      {item.documents.length > 0 && (
        <p className="meta-row">
          <Mark d={ICON.bag} />
          <span>
            {t('bring')}: {item.documents.map((d) => pick(d.name, lang)).join(' · ')}
          </span>
        </p>
      )}

      {step.cost?.amount_ils !== undefined && (
        <p className="meta-row">
          <Mark d={ICON.coin} />
          <span>
            ₪{' '}
            <span className="num">
              {step.cost.amount_ils}
              {step.cost.max_ils ? `–${step.cost.max_ils}` : ''}
            </span>
            {step.cost.note ? ` · ${pick(step.cost.note, lang)}` : ''}
          </span>
        </p>
      )}

      {step.links.map((l) => (
        <p key={l.url} className="meta-row">
          <Mark d={ICON.link} />
          <a href={l.url} target="_blank" rel="noreferrer">
            {pick(l.label, lang)}
          </a>
        </p>
      ))}

      {/* ── the sources, folded ──────────────────────────────────────────
          Nothing is hidden — principle 20 — the sources just stopped
          shouting over the instruction. */}
      <div className="sources">
        <button
          type="button"
          className="btn btn-quiet sources-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Mark d={ICON.clip} />
          <span className="num">{step.evidence.length}</span> {t('sources')}{' '}
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
              <div key={i} className="source">
                <span>
                  <Chip mark={a.mark} lang={lang} />{' '}
                  {a.lead_in[lang] ? `${a.lead_in[lang]}: ` : ''}
                  {a.claim}
                </span>
                {a.citation && <div className="source-citation">{a.citation}</div>}
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

export function Roadmap({
  result,
  lang,
  onToggle,
}: {
  result: Result;
  lang: Lang;
  onToggle?: (id: string, done: boolean) => void;
}) {
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
        {/* ⭐ "התקדמות נמדדת קדימה. מוצג כמה כבר הושלם, לא כמה נותר." */}
        <p className="muted small">
          <span className="num">{doneCount}</span> {t('progress')} {t('of')}{' '}
          <span className="num">{result.roadmap.length}</span> {t('steps_count')}
        </p>
        {doneCount > 0 && (
          <div className="road-progress" aria-hidden="true">
            <span style={{ width: `${(doneCount / result.roadmap.length) * 100}%` }} />
          </div>
        )}
      </div>

      {/* ⭐ A road, not a stack. The spine and its markers live in theme.css;
          each step publishes its state so the marker can colour itself. */}
      <div className="road">
        {result.roadmap.map((item) => (
          <Step key={item.step.id} item={item} lang={lang} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}
