import { useState } from 'react';
import type { Readiness as ReadinessReport, ReadinessItem, ReadinessBucket, Result } from '@byg/engine';
import { UI, pick, type Lang } from '../i18n';

/**
 * ============================================================================
 * The readiness report — "if I went tomorrow, would this work?"
 * ============================================================================
 *
 * Renders exactly what the engine returned. It computes nothing, decides
 * nothing, and re-words nothing: every sentence on this screen was written in
 * the engine, in both languages, next to the rule it came from.
 *
 * ⭐ It sits ABOVE the road, below the urgent notices. The road answers "what is
 * the whole way from here"; this answers the question he actually came with.
 *
 * ⚠️ FOUR BUCKETS, FOUR HEADINGS, and they are never merged. "We did not ask
 * about this" and "you do not have this" are different facts about a person, and
 * one heading over both would make the honest one frightening — the same
 * mistake as rendering an advisory in the red box, which the founder caught on 30.8.
 */

/** The visual weight of each bucket. Only a real problem gets the alert colour. */
const BUCKET: Record<ReadinessBucket, { mark: string; key: keyof typeof UI }> = {
  mismatched: { mark: '⚠️', key: 'r_mismatched' },
  missing: { mark: '○', key: 'r_missing' },
  unconfirmed: { mark: '❔', key: 'r_unconfirmed' },
  ready: { mark: '✅', key: 'r_ready' },
};

function Item({
  item,
  lang,
  titleOf,
}: {
  item: ReadinessItem;
  lang: Lang;
  titleOf: (stepId: string) => string;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const meta = BUCKET[item.bucket];

  // ⚠️ The colour comes from the stylesheet, not from here. Four states that
  // mean four different things are one system, settable in one place.
  return (
    <div className={`bucket bucket-${item.bucket}`}>
      <div className="bucket-item-title">
        <span aria-hidden="true">{meta.mark}</span> {pick(item.title, lang)}
      </div>
      <p className="small">{pick(item.detail, lang)}</p>

      {/* The document's own qualification, where it has one. This is what keeps
          "check you have your glasses" from reaching a man with perfect sight. */}
      {item.note && (
        <p className="small muted">{pick(item.note, lang)}</p>
      )}

      {/* ⚠️ Never bad news alone. The action is where he is standing, so it
          earns the amber, exactly as in the urgent notices. */}
      {item.action && (
        <p
          className="small"
          style={{
            margin: 'var(--gap-xs) 0 0',
            fontWeight: 500,
            borderInlineStart: '3px solid var(--amber)',
            paddingInlineStart: 'var(--gap-sm)',
          }}
        >
          {pick(item.action, lang)}
        </p>
      )}

      {/* ⚠️ Step TITLES, not ids. A report that says "fz.photo_and_eye" is
          not a report. The road used to print raw ids here too, which this
          note once recorded; it no longer does. */}
      <p className="small muted" style={{ margin: 'var(--gap-xs) 0 0' }}>
        {t('r_needed_for')}: {item.needed_for.map(titleOf).join(' · ')}
      </p>
    </div>
  );
}

function Bucket({
  bucket,
  items,
  lang,
  titleOf,
}: {
  bucket: ReadinessBucket;
  items: ReadinessItem[];
  lang: Lang;
  titleOf: (stepId: string) => string;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  // ⭐ The clean bucket starts folded. A man with nine documents in order does
  // not need nine green lines above his road; he needs the two that are not.
  const [open, setOpen] = useState(bucket !== 'ready');
  if (items.length === 0) return null;

  return (
    <section className="stack-sm">
      <button
        type="button"
        className="btn btn-quiet bucket-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{BUCKET[bucket].mark}</span>{' '}
        <strong style={{ color: `var(--bucket-${bucket})` }}>{t(BUCKET[bucket].key)}</strong>{' '}
        <span className="bucket-count num">{items.length}</span>
      </button>
      {open && (
        <div className="stack-sm">
          {items.map((item) => (
            <Item key={item.id} item={item} lang={lang} titleOf={titleOf} />
          ))}
        </div>
      )}
    </section>
  );
}

export function Readiness({ result, lang }: { result: Result; lang: Lang }) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const r = result.readiness;

  // ⚠️ Null for a blocked person, and that is deliberate in the engine: there is
  // no road, so there is nothing to be ready for.
  if (!r) return null;

  const titleOf = (stepId: string) =>
    pick(result.roadmap.find((s) => s.step.id === stepId)?.step.title, lang) || stepId;

  /**
   * ⚠️ Only a real mismatch gets the alert role and the alert colour. A person
   * whose documents are simply not all gathered yet is on step one of a normal
   * process, and a screen reader announcing that as an alert is the audible
   * version of the red box the founder took out on 30.8.
   */
  const alarming = r.verdict === 'mismatch';

  return (
    <section
      className={`card stack notice ${alarming ? 'notice-blocking' : 'notice-quiet'}`}
      role={alarming ? 'alert' : undefined}
      style={{
        borderInlineStartColor: alarming
          ? 'var(--uncertain)'
          : r.verdict === 'ready'
            ? 'var(--verified)'
            : 'var(--line)',
      }}
    >
      <div className="screen-head">
        <h2>{t('readiness_title')}</h2>
        <p>{pick(r.headline, lang)}</p>
      </div>

      {/* ⭐ ONE thing to do next, and the reason it is that one. The whole
          failure this product replaces is "אחרי הטסט אף אחד לא אמר מה השלב הבא" —
          a person holding plenty of information and no idea what to do on
          Monday morning. */}
      {r.first_action && (
        <div
          className="first-action"
          style={{
            padding: 'var(--gap)',
          }}
        >
          <div className="first-action-label">{t('r_first_action')}</div>
          <h3>{pick(r.first_action.title, lang)}</h3>
          {pick(r.first_action.action, lang)
            .split('\n')
            .filter(Boolean)
            .map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          {/* ⚠️ A person told to do step nine before step two assumes the system
              is broken. Both surprising orderings here look wrong until read. */}
          <p className="first-action-why">
            {t('r_why')}: {pick(r.first_action.why, lang)}
          </p>
        </div>
      )}

      {/* ⚠️ Worst first. A man scanning this screen must hit the thing that will
          cost him a day before he hits the things that are fine. */}
      <Bucket bucket="mismatched" items={r.mismatched} lang={lang} titleOf={titleOf} />
      <Bucket bucket="missing" items={r.missing} lang={lang} titleOf={titleOf} />
      <Bucket bucket="unconfirmed" items={r.unconfirmed} lang={lang} titleOf={titleOf} />
      <Bucket bucket="ready" items={r.ready} lang={lang} titleOf={titleOf} />
    </section>
  );
}
