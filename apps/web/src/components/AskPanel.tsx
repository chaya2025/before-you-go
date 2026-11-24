import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { askQuestion, type AskReply, type AskTurn } from '../api';
import { getAccessToken } from '../account';
import { UI, pick, type Lang } from '../i18n';
import { dmy } from './Stale';

/**
 * ============================================================================
 * ⭐ M6: ask about your case (CONTRACT.md section 4)
 * ============================================================================
 *
 * The panel that used to only say the plain-words summary is now a chat. The
 * summary stays as its opening message; under it, his questions and the
 * answers, each answer with the sources it came from.
 *
 * ⚠️ THE RULE ABOVE EVERYTHING: the engine decides, the chat only explains.
 * Nothing here changes the road. If the service is down, the panel says one
 * calm line and every other part of the page works exactly as before.
 *
 * ⚠️ Nothing is saved (D-218). The conversation lives in React state only, so
 * a refresh wipes it. That is on purpose: questions about a person's status
 * are exactly the kind of text this product never wants to keep.
 */

/**
 * Where the chat appears, and in which mode. null = not on this screen.
 *
 * ⚠️ A BLOCKED road never gets the chat. The engine has said he cannot start,
 * and a chat there could read like a second opinion on that. The Blocked
 * screen says what to do; nothing should talk around it.
 * Diagnosis and documents: no chat either, the road is one press away.
 */
export function askModeFor(s: {
  screen: string;
  hasResult: boolean;
  blocked: boolean;
  hasAnswers: boolean;
}): 'case' | 'general' | null {
  if (s.screen === 'roadmap') return s.hasResult && !s.blocked && s.hasAnswers ? 'case' : null;
  if (s.screen === 'welcome' || s.screen === 'intake') return 'general';
  return null;
}

/** One line of the conversation. A question, or the reply it got. */
export type AskEntry = { role: 'user'; text: string } | { role: 'assistant'; reply: AskReply };

/** Replies that carry real words worth sending back as context. */
const SPOKEN = new Set(['answered', 'not_sure', 'other_person']);

/**
 * What gets sent back as "the conversation so far".
 *
 * ⚠️ A question that never got an answer (service down, limit hit) is dropped
 * together with its empty reply. Sending it would make the next answer try to
 * respond to a question the user already gave up on.
 */
export function historyFrom(log: AskEntry[]): AskTurn[] {
  const out: AskTurn[] = [];
  for (let i = 0; i < log.length; i++) {
    const q = log[i];
    const a = log[i + 1];
    if (q?.role !== 'user' || a?.role !== 'assistant') continue;
    if (!SPOKEN.has(a.reply.status) || !a.reply.answer) continue;
    out.push({ role: 'user', text: q.text }, { role: 'assistant', text: a.reply.answer });
    i++;
  }
  return out;
}

/**
 * The conversation's memory and the send button's logic, kept in App so the
 * chat survives closing and reopening the panel (but not a refresh).
 *
 * `profile` and `stepId` are read at the moment of sending, so a step ticked
 * a minute ago is already part of the road the next answer is built on.
 */
export function useAskChat({
  lang,
  mode,
  profile,
  stepId,
}: {
  lang: Lang;
  mode: 'case' | 'general';
  profile?: Record<string, unknown>;
  stepId?: string;
}) {
  const [log, setLog] = useState<AskEntry[]>([]);
  const [busy, setBusy] = useState(false);
  // D-238: true while a quick reply "types": dots only, no "checking…".
  const [quiet, setQuiet] = useState(false);

  // A road just appeared (or went away): a chat about "the process" is not a
  // chat about HIS case, so it starts clean.
  useEffect(() => setLog([]), [mode]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history = historyFrom(log);
    setLog((l) => [...l, { role: 'user', text: q }]);
    setBusy(true);

    // D-238: "hi", "thanks" and friends: answered here, after a short typing
    // pause so it reads like a person and not a vending machine.
    const kind = quickKind(q);
    if (kind) {
      setQuiet(true);
      await new Promise((r) => setTimeout(r, 550));
      const answer = pick(UI[`ask_quick_${kind}`], lang);
      setLog((l) => [...l, { role: 'assistant', reply: { status: 'answered', answer, sources: [] } }]);
      setQuiet(false);
      setBusy(false);
      return;
    }
    const reply = await askQuestion(
      {
        question: q,
        lang,
        mode,
        ...(mode === 'case' && profile ? { profile } : {}),
        ...(stepId ? { step_id: stepId } : {}),
        ...(history.length ? { history } : {}),
      },
      await getAccessToken().catch(() => undefined),
    );
    setLog((l) => [...l, { role: 'assistant', reply }]);
    setBusy(false);
  }

  return { log, busy, quiet, send };
}

/**
 * D-235: the answer as she wants it read. Claude writes one opening sentence,
 * then short lines starting with "- ". Those lines become one bullet list;
 * every other line stays a paragraph. No markdown parser: two cases, by hand.
 */
export function answerBlocks(text: string): Array<{ kind: 'p'; text: string } | { kind: 'ul'; items: string[] }> {
  const out: Array<{ kind: 'p'; text: string } | { kind: 'ul'; items: string[] }> = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-•*]\s+(.*)$/.exec(line);
    const prev = out[out.length - 1];
    if (bullet) {
      if (prev?.kind === 'ul') prev.items.push(bullet[1] ?? '');
      else out.push({ kind: 'ul', items: [bullet[1] ?? ''] });
    } else out.push({ kind: 'p', text: line });
  }
  return out;
}

/**
 * D-238: the obvious "not a question" messages, answered in the browser with
 * no server call, so "hi" feels like hi. Only a WHOLE message on this list
 * counts; anything else (even "thanks, and the cost?") goes to the server,
 * where Haiku labels the less obvious ones (D-237).
 */
const QUICK: Record<'thanks' | 'hello' | 'bye' | 'ok', string[]> = {
  thanks: ['תודה', 'תודה רבה', 'תודה רבה רבה', 'אחלה תודה', 'מעולה תודה', 'סבבה תודה', 'תנקס', 'thanks', 'thank you', 'thanks a lot', 'thx', 'ty', 'great thanks'],
  hello: ['היי', 'הי', 'שלום', 'הלו', 'בוקר טוב', 'ערב טוב', 'צהריים טובים', 'hi', 'hey', 'hello', 'good morning', 'good evening'],
  bye: ['ביי', 'ביי ביי', 'להתראות', 'יום טוב', 'לילה טוב', 'bye', 'goodbye', 'see you', 'have a nice day'],
  ok: ['אוקיי', 'אוקי', 'אוקיי הבנתי', 'הבנתי', 'סבבה', 'אחלה', 'מעולה', 'ok', 'okay', 'got it', 'great', 'cool'],
};

export function quickKind(text: string): keyof typeof QUICK | null {
  // Lower case, no punctuation or emoji, single spaces: "תודה רבה!!" = "תודה רבה".
  const t = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;
  for (const kind of Object.keys(QUICK) as Array<keyof typeof QUICK>) {
    if (QUICK[kind].includes(t)) return kind;
  }
  return null;
}

/** A real date only. Anything else is left out rather than printed as "NaN". */
const isDate = (s: string | null | undefined): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}/.test(s));

/**
 * D-226: what the button under an other_person reply does.
 *   'start' = nothing of his would be lost, so it opens the questions fresh.
 *   'home'  = starting would replace his saved case, so it only goes to the
 *             landing page, and he decides there.
 */
export type OtherPersonAction = 'start' | 'home';

/** D-236: Tal's face. One letter on a dark round, like a profile photo. */
function Avatar({ lang, size }: { lang: Lang; size?: 'big' }) {
  return (
    <span className={size === 'big' ? 'ask-avatar ask-avatar-big' : 'ask-avatar'} aria-hidden="true">
      {pick(UI.ask_name, lang).slice(0, 1)}
    </span>
  );
}

function Reply({
  reply,
  lang,
  otherPerson,
  onOtherPerson,
}: {
  reply: AskReply;
  lang: Lang;
  otherPerson?: OtherPersonAction;
  onOtherPerson?: () => void;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);

  // These two have no answer to show: their line lives at the foot of the
  // panel (limit) or replaces the box (no_login).
  if (reply.status === 'no_login') return null;
  if (reply.status === 'unavailable' || reply.status === 'limit') {
    return <p className="ask-note">{t(reply.status === 'limit' ? 'ask_limit' : 'ask_unavailable')}</p>;
  }

  // The service's own words when it has them; ours when it sends none.
  const fallback = reply.status === 'not_sure' ? t('ask_not_sure') : reply.status === 'other_person' ? t('ask_other_person') : '';
  const text = reply.answer || fallback;

  return (
    <div className="ask-turn">
      <Avatar lang={lang} />
      <div className="ask-msg ask-msg-reply">
      <span className="ask-sr">{t('ask_reply')}: </span>
      {answerBlocks(text).map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i} className="ask-points">
            {b.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ),
      )}

      {reply.status === 'other_person' && otherPerson && (
        <button type="button" className="btn btn-quiet ask-other" onClick={onOtherPerson}>
          {t(otherPerson === 'start' ? 'ask_other_start' : 'ask_other_home')}
        </button>
      )}

      {/* ⭐ Every answer shows where it came from, and when that was last
          checked. Same promise as the road: nothing unsourced.
          D-235: folded into one small link, so it is there but not in his face. */}
      {reply.sources.length > 0 && (
        <details className="ask-sources">
          <summary>
            {t('ask_sources')} <span className="ask-count num">{reply.sources.length}</span>
          </summary>
          <ul>
            {reply.sources.map((s, i) => (
              <li key={i}>
                <span>{s.citation ?? s.claim}</span>
                {isDate(s.last_verified_at) && (
                  <span className="muted">
                    {' · '}
                    {t('ask_checked')} <span className="num">{dmy(s.last_verified_at)}</span>
                  </span>
                )}
                {s.url && (
                  <>
                    {' · '}
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {t('ask_source_open')}
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      </div>
    </div>
  );
}

export function AskPanel({
  lang,
  mode,
  loggedIn,
  canLogin,
  log,
  busy,
  quiet,
  step,
  opening,
  onSend,
  onClearStep,
  onClose,
  onLogin,
  otherPerson,
  onOtherPerson,
}: {
  lang: Lang;
  mode: 'case' | 'general';
  loggedIn: boolean;
  /** False where accounts are switched off: there is no login to offer. */
  canLogin: boolean;
  log: AskEntry[];
  busy: boolean;
  /** D-238: a quick reply is "typing": show the dots without words. */
  quiet?: boolean;
  /** The step he pressed "ask about this step" on, if any (D-227). */
  step: { id: string; title: string } | null;
  /** The first message: the plain-words summary in case mode. */
  opening?: ReactNode;
  onSend: (question: string) => void;
  onClearStep: () => void;
  onClose: () => void;
  onLogin: () => void;
  /** D-226: the button under an "only your case" reply. Left out = no button. */
  otherPerson?: OtherPersonAction;
  onOtherPerson?: () => void;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const login = useRef<HTMLButtonElement>(null);
  const end = useRef<HTMLDivElement>(null);
  // D-235: the wait changes its words every ~2 seconds, so it feels alive.
  const waits = ['ask_thinking', 'ask_thinking_2', 'ask_thinking_3'] as const;
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (!busy) return setWait(0);
    const id = setInterval(() => setWait((w) => Math.min(w + 1, waits.length - 1)), 2000);
    return () => clearInterval(id);
  }, [busy]);

  const last = log[log.length - 1];
  const lastStatus = last?.role === 'assistant' ? last.reply.status : null;
  // A login that ran out mid-chat looks exactly like never having logged in.
  const needLogin = !loggedIn || lastStatus === 'no_login';
  const limited = lastStatus === 'limit';
  const title = mode === 'general' ? t('ask_open_general') : t('ask_open');
  const chipsCase = ['ask_chip_bring', 'ask_chip_cost', 'ask_chip_next'] as const;
  const chipsGeneral = ['ask_chip_what', 'ask_chip_start', 'ask_chip_form'] as const;

  // Opening the panel puts the cursor where he types (or on the login, when
  // that is the only thing he can do here).
  useEffect(() => {
    (needLogin ? login.current : input.current)?.focus();
  }, [needLogin, step?.id]);

  // A new line scrolls into view, so the answer is never below the fold.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' });
  }, [log.length, busy]);

  return (
    <aside
      className="ask-panel"
      role="dialog"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="ask-head">
        <div className="ask-who">
          <Avatar lang={lang} size="big" />
          <div>
            <h2>{t('ask_name')}</h2>
            <p className="ask-status">
              <span className="ask-online" aria-hidden="true" />
              {title}
            </p>
          </div>
        </div>
        <button type="button" className="ask-close" aria-label={t('ask_close')} onClick={onClose}>
          ×
        </button>
      </div>
      {opening}

      <div className="ask-log" aria-live="polite">
        {/* D-235: Tal speaks first, like a person at a desk. */}
        <div className="ask-turn">
          <Avatar lang={lang} />
          <div className="ask-msg ask-msg-reply ask-hello">
            <p>{t('ask_hello')}</p>
          </div>
        </div>
        {/* D-236: ready questions, like every chat widget. One press sends it. */}
        {log.length === 0 && !needLogin && !busy && (
          <div className="ask-chips">
            {(mode === 'case' ? chipsCase : chipsGeneral).map((k) => (
              <button key={k} type="button" className="ask-chip" onClick={() => onSend(t(k))}>
                {t(k)}
              </button>
            ))}
          </div>
        )}
        {log.map((e, i) =>
          e.role === 'user' ? (
            <div key={i} className="ask-msg ask-msg-user">
              <span className="ask-sr">{t('ask_you')}: </span>
              {e.text}
            </div>
          ) : (
            <Reply key={i} reply={e.reply} lang={lang} otherPerson={otherPerson} onOtherPerson={onOtherPerson} />
          ),
        )}
        {busy && (
          <div className="ask-turn" role="status">
            <Avatar lang={lang} />
            <div className="ask-msg ask-msg-reply ask-typing">
              <span className="ask-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {!quiet && <span className="ask-typing-text">{t(waits[wait] ?? 'ask_thinking')}</span>}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      {needLogin ? (
        // ⚠️ Accounts switched off where this is deployed: there is no login
        // to offer, so it is simply not available, not a dead button.
        canLogin ? (
          <div className="ask-login">
            <p className="ask-note">{t('ask_no_login')}</p>
            <button ref={login} type="button" className="btn btn-quiet" onClick={onLogin}>
              {t('acct_open')}
            </button>
          </div>
        ) : (
          <p className="ask-note">{t('ask_unavailable')}</p>
        )
      ) : (
        <form
          className="ask-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim() || busy || limited) return;
            onSend(draft);
            setDraft('');
          }}
        >
          {step && (
            <p className="ask-about">
              <span>
                {t('ask_about')} <strong>{step.title}</strong>
              </span>
              <button type="button" aria-label={t('ask_about_clear')} onClick={onClearStep}>
                ×
              </button>
            </p>
          )}
          <label htmlFor={inputId} className="ask-sr">
            {t('ask_label')}
          </label>
          <div className="ask-row">
            {/* A plain text box inside a form: Enter sends, with no key handling of our own. */}
            <input
              ref={input}
              id={inputId}
              type="text"
              value={draft}
              maxLength={800}
              autoComplete="off"
              enterKeyHint="send"
              placeholder={t('ask_placeholder')}
              disabled={limited}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="ask-send" disabled={busy || limited || !draft.trim()}>
              <span className="ask-sr">{t('ask_send')}</span>
              {/* A paper plane. Flipped by CSS in Hebrew, so it points the way text runs. */}
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10.2 15 12 3.4 13.8z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}
