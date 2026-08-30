import type { UrgentIssue } from '@byg/engine';
import { pick, type Lang } from '../i18n';

/**
 * ============================================================================
 * Urgent — deal with these before the roadmap means anything
 * ============================================================================
 *
 * From the POC document:
 *   "אשרה שפג תוקפה אינה הערת שוליים במפת הדרכים — היא הופכת לשלב הראשון בה."
 *
 * ⚠️ Added 27.8 after the founder noticed the diagnosis was not affecting the roadmap.
 * An audit confirmed it: answering "my visa is not valid" changed nothing at
 * all, and asking to convert to a bus produced an ordinary conversion roadmap
 * that could never end in a licence. Both are now surfaced here, above the road.
 *
 * ⚠️ These are NOT rejections. He is eligible. Something specific is in the way,
 * and every one of them carries the action that clears it — the brand rule is
 * "לעולם לא מסך דחייה יבש".
 */
export function Urgent({ issues, lang }: { issues: UrgentIssue[]; lang: Lang }) {
  if (issues.length === 0) return null;

  return (
    <div className="stack-sm">
      {issues.map((issue) => {
        /**
         * ⚠️ the founder, 30.8. An advisory is NOT an alert.
         *
         * A visa expiring in three days does not stop him: he can go to the
         * office today and be served. Rendering that with role="alert" and a
         * warning triangle tells him to deal with it first, and a person who
         * reads that may not go at all, losing the days he still had.
         *
         * So only a blocker gets the alert role, the triangle and the
         * uncertain-colour edge. An advisory is quieter on purpose.
         */
        const blocking = issue.severity === 'blocking';
        return (
        <section
          key={issue.id}
          className="card stack-sm"
          role={blocking ? 'alert' : undefined}
          style={{
            borderInlineStartWidth: '4px',
            borderInlineStartColor: blocking ? 'var(--uncertain)' : 'var(--muted)',
            background: 'var(--surface)',
          }}
        >
          <h3>{blocking ? '⚠️ ' : 'ℹ️ '}{pick(issue.title, lang)}</h3>
          <p>{pick(issue.consequence, lang)}</p>
          {/* The action is where he is standing now, so it earns the amber. */}
          <p
            style={{
              fontWeight: 500,
              borderInlineStart: '3px solid var(--amber)',
              paddingInlineStart: 'var(--gap-sm)',
            }}
          >
            {pick(issue.action, lang)}
          </p>
        </section>
        );
      })}
    </div>
  );
}
