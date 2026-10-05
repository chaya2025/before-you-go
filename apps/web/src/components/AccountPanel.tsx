import { useEffect, useRef, useState, type FormEvent } from 'react';
import { UI, pick, type Lang } from '../i18n';
import {
  MIN_PASSWORD,
  checkCredentials,
  emailLogin,
  logIn,
  logInWithGoogle,
  sendReset,
  setNewPassword,
  signUp,
  type AuthProblem,
} from '../account';

export type PanelMode = 'login' | 'signup' | 'forgot' | 'sent-signup' | 'sent-reset' | 'newpass' | 'expired';

/**
 * The account window (M1). One panel, several modes, so log in, sign up and
 * forgot-password share one place instead of three screens.
 *
 * ⭐ A native <dialog> opened with showModal(): the browser itself keeps
 * keyboard focus inside it, closes it on Escape, and dims the page behind.
 * That is accessibility we would otherwise have to build by hand.
 */
export function AccountPanel({
  lang,
  mode: startMode,
  onClose,
}: {
  lang: Lang;
  mode: PanelMode;
  onClose: () => void;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<PanelMode>(startMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const go = (m: PanelMode) => {
    setMode(m);
    setProblem(null);
    setPassword('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    // Sign-up and new password get the length rule. Log-in only needs "not
    // empty": the rule is for choosing a password, not for typing one.
    const local: AuthProblem | null =
      mode === 'newpass' ? (password.length < MIN_PASSWORD ? 'weak_password' : null)
      : mode === 'signup' ? checkCredentials(email, password)
      : checkCredentials(email, null) ?? (mode === 'login' && !password ? 'bad_login' : null);
    if (local) return setProblem(local);

    setBusy(true);
    setProblem(null);
    const r =
      mode === 'login' ? await logIn(email, password)
      : mode === 'signup' ? await signUp(email, password)
      : mode === 'forgot' ? await sendReset(email)
      : await setNewPassword(password);
    setBusy(false);

    if (!r.ok) return setProblem(r.problem);
    if (mode === 'signup') return go('sent-signup');
    if (mode === 'forgot') return go('sent-reset');
    if (mode === 'newpass') return setSaved(true);
    onClose(); // logged in
  }

  async function google() {
    setBusy(true);
    const r = await logInWithGoogle();
    // On success the browser is already leaving for Google.
    if (!r.ok) {
      setBusy(false);
      setProblem(r.problem);
    }
  }

  const title =
    mode === 'login' ? t('acct_login_title')
    : mode === 'signup' ? t('acct_signup_title')
    : mode === 'forgot' ? t('acct_forgot_title')
    : mode === 'newpass' ? t('acct_newpass_title')
    : mode === 'expired' ? t('acct_expired_title')
    : t('acct_sent_title');

  return (
    <dialog ref={ref} className="acct" onClose={onClose} aria-labelledby="acct-title">
      <div className="acct-in stack">
        <div className="acct-head">
          <h2 id="acct-title">{title}</h2>
          <button className="btn btn-quiet" onClick={() => ref.current?.close()} aria-label={t('acct_close')}>
            ✕
          </button>
        </div>

        {(mode === 'login' || mode === 'signup') && (
          <>
            <p className="muted small">{t('acct_why')}</p>
            <button className="btn acct-google" onClick={google} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8z" />
                <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z" />
                <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
              </svg>
              {t('acct_google')}
            </button>
            {emailLogin && <p className="acct-or muted small">{t('acct_or')}</p>}
          </>
        )}

        {(mode === 'sent-signup' || mode === 'sent-reset') && (
          <>
            <p>{t(mode === 'sent-signup' ? 'acct_sent_signup' : 'acct_sent_reset')}</p>
            <button className="btn btn-quiet" onClick={() => go('login')}>{t('acct_back_login')}</button>
          </>
        )}

        {mode === 'expired' && (
          <>
            <p>{t('acct_expired_body')}</p>
            {emailLogin && (
              <button className="btn btn-primary" onClick={() => go('forgot')}>{t('acct_send_new')}</button>
            )}
          </>
        )}

        {mode === 'newpass' && saved && <p role="status">{t('acct_password_saved')}</p>}

        {problem && !emailLogin && mode !== 'newpass' && (
          <p className="field-error" role="alert">{t(`acct_err_${problem}` as keyof typeof UI)}</p>
        )}

        {((emailLogin && (mode === 'login' || mode === 'signup' || mode === 'forgot')) || (mode === 'newpass' && !saved)) && (
          <form className="stack" onSubmit={submit} noValidate>
            {mode === 'forgot' && <p className="muted small">{t('acct_forgot_note')}</p>}
            {mode !== 'newpass' && (
              <div className="field">
                <label htmlFor="acct-email">{t('acct_email')}</label>
                <input
                  id="acct-email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={problem === 'bad_email' || undefined}
                />
              </div>
            )}
            {mode !== 'forgot' && (
              <div className="field">
                <label htmlFor="acct-password">{t('acct_password')}</label>
                {mode !== 'login' && <p className="field-note">{t('acct_password_note')}</p>}
                <input
                  id="acct-password"
                  type="password"
                  dir="ltr"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={problem === 'weak_password' || undefined}
                />
              </div>
            )}

            {problem && (
              <p className="field-error" role="alert">
                {t(`acct_err_${problem}` as keyof typeof UI)}
              </p>
            )}

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy
                ? t('loading')
                : mode === 'login' ? t('acct_do_login')
                : mode === 'signup' ? t('acct_do_signup')
                : mode === 'forgot' ? t('acct_send_link')
                : t('acct_save_password')}
            </button>
          </form>
        )}

        {emailLogin && mode === 'login' && (
          <div className="acct-links small">
            <button className="linkish" onClick={() => go('forgot')}>{t('acct_forgot')}</button>
            <button className="linkish" onClick={() => go('signup')}>{t('acct_to_signup')}</button>
          </div>
        )}
        {emailLogin && mode === 'signup' && (
          <div className="acct-links small">
            <button className="linkish" onClick={() => go('login')}>{t('acct_to_login')}</button>
          </div>
        )}
        {mode === 'forgot' && (
          <div className="acct-links small">
            <button className="linkish" onClick={() => go('login')}>{t('acct_back_login')}</button>
          </div>
        )}
      </div>
    </dialog>
  );
}
