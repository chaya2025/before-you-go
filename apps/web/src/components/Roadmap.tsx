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
 * Carries the corrections from 26.8, all of them Chaya's:
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
  /* A padlock. Used once, on a row the order will not let him start yet. */
  lock: 'M7 11V8a5 5 0 0110 0v3M6 11h12a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7a1 1 0 011-1z',
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

/* The three shapes a "where" can take: a screen, a counter, a postbox. */
const CHANNEL_ICON: Record<string, string> = {
  online: 'M4 5h16v10H4zM9 19h6M12 15v4',
  mail: 'M4 7h16v10H4zM4 8l8 5 8-5',
  default: 'M12 21s7-5.3 7-11a7 7 0 10-14 0c0 5.7 7 11 7 11z',
};

function Step({
  item,
  index,
  lang,
  titleOf,
  onToggle,
  pending,
  compact,
}: {
  item: RoadmapStep;
  index: number;
  lang: Lang;
  /** An id turned back into the name of the step a person can see. */
  titleOf: (id: string) => string;
  onToggle?: (id: string, done: boolean) => void;
  /** The id of the step whose tick is in flight, if any. */
  pending?: string | null;
  /** A step that is not for today: one row, opened on a tap. */
  compact?: boolean;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const [open, setOpen] = useState(false);
  const { step } = item;

  const dimmed = item.state === 'later' || item.state === 'waiting_on';
  /** The order says this one cannot be done yet, and it names what first. */
  const blocked = item.state === 'waiting_on' && item.waiting_on.length > 0;
  const shown = attributions(step.evidence);

  // The count by mark: what kind of evidence is behind this, at a glance,
  // without reading five near-identical lines.
  const counts = new Map<CertaintyMark, number>();
  for (const part of step.evidence) {
    counts.set(part.certainty, (counts.get(part.certainty) ?? 0) + 1);
  }

  /**
   * ⭐ The head is the only part of a step that a person scanning the road
   * actually needs: which number, what it is, where it stands. Everything
   * else is what he needs once he has decided to do THIS one. On a step that
   * is not for today, the head is the whole row and the rest opens on a tap.
   */
  const head = (
    <>
      {/* ⭐ The number a person uses to say where he is out loud — "I'm on
          four". The order is what this whole product is about. */}
      <span className="step-index" aria-hidden="true">
        {index}
      </span>
      <h3>{pick(step.title, lang)}</h3>
      <span className="step-head-meta">
        {/* ⭐ WHERE, on the row itself. Sixteen steps are spread over eight
            different places — the population authority, a photo station, a
            driving school, a test centre, the post office — and a person
            planning a week needs to see that without opening anything. It is
            the one piece of a step that differs on every single row, which is
            what makes it worth the space and not more of the same words. */}
        {compact && step.channel && step.channel !== 'unknown' && (
          <span className="step-where">{t(`ch_${step.channel}` as keyof typeof UI)}</span>
        )}

        {/* ⚠️ A state is worth a WORD only when it is not the one the section
            already announced. Every row in "בהמשך הדרך" used to carry a chip
            reading "בהמשך": the heading said it once and then fifteen chips
            said it again. Declaring the real ordering chain on 22.9 made it
            worse in the other direction — fourteen of fifteen rows became
            "ממתין", which distinguishes nothing.

            So on a row: the majority state is silent, a blocked step carries
            a padlock rather than a sentence (the sentence is inside, on the
            tick it replaces), and only a genuinely unplaceable step gets a
            word, because that one is rare and strange. */}
        {compact ? (
          blocked ? (
            <span className="step-lock" title={t('locked_until')} aria-label={t('locked_until')}>
              <Mark d={ICON.lock} />
            </span>
          ) : item.state === 'uncertain' ? (
            <span className="step-state step-state-uncertain">{t('state_uncertain')}</span>
          ) : null
        ) : (
          <span className={`step-state step-state-${item.state}`}>
            {t(`state_${item.state}` as keyof typeof UI)}
          </span>
        )}
      </span>
    </>
  );

  const body = (
    <>

      {/* ⭐ Ticking a step re-runs the whole engine. That is what makes the map
          move with him instead of describing a stranger — and it is what starts
          the clocks that only exist once he is in a particular situation. */}
      {/* ⚠️ The line saying the engine is running sits at the top of the page.
          Photographed (evidence/m5-working), the tick that starts it is often
          a screen and a half below it: he presses, and the only acknowledgement
          is somewhere he cannot see. So the row he pressed says it too, and
          takes no second press while the first is still in flight. */}
      {/* ⭐ A STEP THE ENGINE SAYS IS BLOCKED CANNOT BE TICKED, 22.9.
          Chaya: "some steps can't come before others, it just doesn't make
          sense, we have to force some rules". The engine already computes
          this — `must_come_after` minus what is done becomes `waiting_on` —
          and the road printed the answer and then handed him a tick box
          anyway. Ticking it wrote a completed step the order says is
          impossible, and every clock and every later state was then computed
          off it. The box says what it is waiting for, and comes back the
          moment that step is ticked. */}
      {onToggle && (
        <label
          className={`step-tick${pending === step.id ? ' step-tick-busy' : ''}${
            blocked ? ' step-tick-blocked' : ''
          }`}
        >
          <input
            type="checkbox"
            checked={item.state === 'done'}
            disabled={Boolean(pending) || blocked}
            onChange={(e) => onToggle(step.id, e.target.checked)}
          />
          <span className="small muted">
            {pending === step.id
              ? t('updating_road')
              : blocked
                ? `${t('locked_until')} ${item.waiting_on.map(titleOf).join(' · ')}`
                : item.state === 'done'
                  ? t('marked_done')
                  : t('mark_done')}
          </span>
        </label>
      )}

      {/* Where it happens, as a chip: the WHERE is what he plans his day
          around, and it should be findable without reading the paragraph. */}
      {step.channel && step.channel !== 'unknown' && (
        <span className={`step-channel${step.channel === 'online' ? ' step-channel-online' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d={CHANNEL_ICON[step.channel] ?? CHANNEL_ICON.default}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t(`ch_${step.channel}` as keyof typeof UI)}
        </span>
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

      {/* ⚠️ `start_now` is the engine saying what KIND of step this is — one
          that takes months and must be begun early — and it says it whatever
          state the step is in. The sentence the website builds out of it is
          an instruction for today. Found by ticking the whole road: every
          finished step still carried an amber "התחל כבר היום". A step he has
          already done is not a step to start. */}
      {item.start_now && item.state !== 'done' && (
        <p className="flag">
          <span>
            <strong>{t('start_now')}</strong> — {t('start_now_why')}
          </span>
        </p>
      )}

      {item.must_precede && (
        <p className="flag">
          <span>
            {t('before')} {titleOf(item.must_precede)}
          </span>
        </p>
      )}

      {item.waiting_on.length > 0 && (
        <p className="meta-row">
          <Mark d={ICON.wait} />
          <span>
            {t('waiting_for')}: {item.waiting_on.map(titleOf).join(' · ')}
          </span>
        </p>
      )}

      {/* ⭐ Chaya's rule: thin evidence gets advice with its recovery built in,
          never a hedge. "לך בלי תור, ואם דוחים — קבע תור באותו רגע." */}
      {step.fallback && <p className="flag flag-quiet"><span>{pick(step.fallback, lang)}</span></p>}

      {/* An unplaceable step stays, and says which answer would settle it. */}
      {item.applies === 'unknown' && (
        <p className="small" style={{ color: 'var(--unchecked)' }}>
          ❔ {t('uncertain_step')} — {t('uncertain_answer')}:{' '}
          <span className="ltr">{item.missing_answers.join(', ')}</span>
        </p>
      )}

      {/* ⭐ Measured on the real answer page, 22.9: the four standing conditions
          were reprinted inside step cards TEN more times, and "האשרה חייבת
          להיות בתוקף" appeared six times on one screen. `checks_first` is by
          construction a SUBSET of `standing_conditions` — the engine filters
          the same list by which steps each one guards — so every one of those
          sentences was already on the sticky note beside the road. Saying a
          rule six times does not make it six rules; it makes the page unread.
          One marker, and the note it points at keeps the wording. */}
      {item.checks_first.length > 0 && (
        <a className="step-standing" href="#standing">
          <Mark d={ICON.look} />
          <span>
            {t('standing_here')} <span className="num">{item.checks_first.length}</span>
            <span className="print-only"> · {t('standing_on_paper')}</span>
          </span>
        </a>
      )}

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
    </>
  );

  /**
   * ⚠️ Sixteen open cards in one column is the page Chaya walked and called
   * "too much text" — 8,606px of it, about nine laptop screens. A step that
   * is not for today is a LINE: number, title, state. Nothing is hidden,
   * which is principle 20; it is folded, and the fold says what is inside.
   */
  if (compact) {
    return (
      <article
        data-state={item.state}
        className={`step step-row${dimmed ? ' step-later' : ''}${item.state === 'done' ? ' step-done' : ''}`}
      >
        <details>
          <summary className="step-head">{head}</summary>
          <div className="stack-sm step-row-body">{body}</div>
        </details>
      </article>
    );
  }

  return (
    <article
      // ⭐ The marker on the spine reads this. Amber, and only amber, marks
      // where you are standing — now as a diamond ON the road rather than an
      // edge beside it, so it is findable without reading.
      data-state={item.state}
      className={`card stack-sm step${dimmed ? ' step-later' : ''}${item.state === 'done' ? ' step-done' : ''}`}
    >
      <div className="step-head">{head}</div>
      {body}
    </article>
  );
}

/**
 * ⭐ What he has to keep in mind while walking the road: the clocks, and the
 * conditions that must stay true the whole way. Split out of the roadmap on
 * 22.9 so they can sit BESIDE the road and stay visible while he scrolls —
 * in the middle of a list of forty steps, a deadline is just another item.
 */
export function RoadSide({ result, lang }: { result: Result; lang: Lang }) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);

  return (
    <>
      {result.clocks.length > 0 && (
        <section className="note note-clocks">
          <h3>{t('clocks_title')}</h3>
          {result.clocks.map((c) => (
            <Clock key={c.clock.id} clock={c} lang={lang} />
          ))}
        </section>
      )}

      {/* ⚠️ A standing condition is not a step and must not look like one: it
          is what has to stay true for the whole road, and breaking it undoes
          work already done. Her word for it was a sticky note. */}
      {result.standing_conditions.length > 0 && (
        /* ⚠️ The id is the destination of the marker inside every step that
           these conditions guard. They are written here, once. */
        <section className="note" id="standing">
          <h3>{t('standing_title')}</h3>
          <p className="muted small">{t('standing_note')}</p>
          <ul className="note-list">
            {result.standing_conditions.map((c) => (
              <li key={c.id}>
                <details>
                  <summary>{pick(c.name, lang)}</summary>
                  <p className="small">{pick(c.consequence_if_invalid, lang)}</p>
                  <p className="small">
                    <strong>{pick(c.remedy, lang)}</strong>
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * The road itself, in three named parts.
 *
 * ⚠️ The grouping is read off the state the ENGINE gave each step. The website
 * does not decide what is doable now — that is a rule about visas and clocks,
 * and it belongs where every other such rule lives.
 */
export function Roadmap({
  result,
  lang,
  onToggle,
  pending,
}: {
  result: Result;
  lang: Lang;
  onToggle?: (id: string, done: boolean) => void;
  /** The id of the step whose tick is in flight, if any. */
  pending?: string | null;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);

  const now = result.roadmap.filter((s) => s.state === 'do_now');
  const done = result.roadmap.filter((s) => s.state === 'done');
  const later = result.roadmap.filter((s) => s.state !== 'do_now' && s.state !== 'done');

  /* ⚠️ Two different empty "now" parts, and they were getting the same
     sentence. Nothing startable WITH steps remaining means he is waiting on
     something; nothing startable with NOTHING remaining means he is finished.
     The old copy told a man who had ticked every step to go and open a part
     of the page that is not there. */
  const allDone = result.roadmap.length > 0 && done.length === result.roadmap.length;

  /* ⚠️ The number is the step's place in the WHOLE road, not in its part.
     Numbering each part from one would tell a person on step nine that he is
     on step one, which is precisely the reassurance this product must not
     manufacture. */
  const position = new Map(result.roadmap.map((item, i) => [item.step.id, i + 1]));

  /**
   * ⚠️ An id is not a sentence. This screen printed "ממתין ל: fz.doc_89"
   * straight at the reader, and on the printed sheet he carries into the
   * office it is the same. The readiness report already resolved ids to
   * titles and left a note saying the roadmap did not; it does now.
   *
   * A step can wait on something outside this road, so an id with no step
   * behind it falls back to itself rather than disappearing.
   */
  const titles = new Map(result.roadmap.map((item) => [item.step.id, pick(item.step.title, lang)]));
  const titleOf = (id: string) => titles.get(id) ?? id;

  const list = (items: typeof result.roadmap, compact = false) => (
    <div className={`road${compact ? ' road-rows' : ''}`}>
      {items.map((item) => (
        <Step
          key={item.step.id}
          item={item}
          index={position.get(item.step.id) ?? 0}
          lang={lang}
          titleOf={titleOf}
          onToggle={onToggle}
          pending={pending}
          compact={compact}
        />
      ))}
    </div>
  );

  return (
    <div className="stack">
      <section className="road-part road-part-now" id="now">
        <div className="road-part-head">
          <h3>{t('road_now')}</h3>
          <span className="count num">{now.length}</span>
        </div>
        {now.length > 0 ? (
          <>
            <p className="road-part-note">{t('road_now_note')}</p>
            {list(now)}
          </>
        ) : (
          <p className="road-part-note">{t(allDone ? 'road_all_done' : 'road_empty_now')}</p>
        )}
      </section>

      {later.length > 0 && (
        <section className="road-part road-part-later">
          <div className="road-part-head">
            <h3>{t('road_next')}</h3>
            <span className="count num">{later.length}</span>
          </div>
          <p className="road-part-note">{t('road_next_note')}</p>
          {list(later, true)}
        </section>
      )}

      {/* Nothing is hidden — principle 20 — a finished step is simply not what
          he came here to read, so it folds. */}
      {done.length > 0 && (
        <details className="road-part road-part-done" open={allDone}>
          <summary>
            {t('road_done')} · <span className="num">{done.length}</span>
          </summary>
          {list(done, true)}
        </details>
      )}
    </div>
  );
}
