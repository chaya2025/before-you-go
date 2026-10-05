import { useState } from 'react';
import { UI, pick, type Lang } from '../i18n';
import {
  changeEmail,
  checkCredentials,
  deleteAccount,
  setNewPassword,
  type Account,
  type AuthProblem,
} from '../account';

/**
 * M1 milestone 4 (D-152): the account settings page, from the account menu.
 *
 * ⚠️ A Google login has no address or password here to change: Google owns
 * both, so he sees neither form, and no line about it (Chaya: keep it plain).
 * Email logins get both forms.
 */
export function Settings({
  account,
  lang,
  onBack,
  onPrivacy,
  onDeleted,
}: {
  account: NonNullable<Account>;
  lang: Lang;
  onBack: () => void;
  onPrivacy: () => void;
  onDeleted: () => void;
}) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const err = (p: AuthProblem) => t(`acct_err_${p}` as keyof typeof UI);

  const [email, setEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [delProblem, setDelProblem] = useState<AuthProblem | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const bad = checkCredentials(email, null);
    if (bad) return setEmailMsg({ ok: false, text: err(bad) });
    setBusy(true);
    const r = await changeEmail(email);
    setBusy(false);
    setEmailMsg(r.ok ? { ok: true, text: t('set_email_sent') } : { ok: false, text: err(r.problem) });
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    const bad = checkCredentials(account.email, pw);
    if (bad) return setPwMsg({ ok: false, text: err(bad) });
    setBusy(true);
    const r = await setNewPassword(pw);
    setBusy(false);
    if (r.ok) setPw('');
    setPwMsg(r.ok ? { ok: true, text: t('set_pw_done') } : { ok: false, text: err(r.problem) });
  }

  async function confirmDelete() {
    setBusy(true);
    setDelProblem(null);
    const r = await deleteAccount();
    setBusy(false);
    if (r.ok) onDeleted();
    else setDelProblem(r.problem);
  }

  return (
    <main className="page stack settings">
      <button className="btn btn-quiet back-link" onClick={onBack}>
        {t('set_back')}
      </button>
      <h2>{t('set_title')}</h2>

      <section className="card stack-sm" aria-labelledby="set-acct">
        <h3 id="set-acct">{t('set_account')}</h3>
        <p>
          <span className="muted">{t('set_logged_in_as')}</span> <strong className="ltr">{account.email}</strong>
        </p>
        {!account.google && (
          <>
            <form className="stack-sm" onSubmit={submitEmail} noValidate>
              <div className="field">
                <label htmlFor="set-email">{t('set_new_email')}</label>
                <input id="set-email" type="email" className="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {emailMsg && <p className={emailMsg.ok ? 'small' : 'field-error'} role={emailMsg.ok ? 'status' : 'alert'}>{emailMsg.text}</p>}
              <button className="btn btn-quiet" type="submit" disabled={busy || !email}>{t('set_change_email')}</button>
            </form>
            <form className="stack-sm" onSubmit={submitPassword} noValidate>
              <div className="field">
                <label htmlFor="set-pw">{t('set_new_pw')}</label>
                <input id="set-pw" type="password" className="ltr" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              {pwMsg && <p className={pwMsg.ok ? 'small' : 'field-error'} role={pwMsg.ok ? 'status' : 'alert'}>{pwMsg.text}</p>}
              <button className="btn btn-quiet" type="submit" disabled={busy || !pw}>{t('set_change_pw')}</button>
            </form>
          </>
        )}
      </section>

      <section className="card stack-sm" aria-labelledby="set-data">
        <h3 id="set-data">{t('set_data')}</h3>
        <p className="small">{t('set_data_body')}</p>
        <button className="btn btn-quiet" onClick={onPrivacy}>{t('priv_link')}</button>
      </section>

      <section className="card stack-sm danger-zone" aria-labelledby="set-del">
        <h3 id="set-del">{t('set_delete')}</h3>
        <p className="small">{t('set_delete_body')}</p>
        {!confirming ? (
          <button className="btn btn-danger" onClick={() => setConfirming(true)}>{t('set_delete_btn')}</button>
        ) : (
          <div className="stack-sm" role="alertdialog" aria-labelledby="set-del-q">
            <p id="set-del-q"><strong>{t('set_delete_sure')}</strong></p>
            <div className="row-btns">
              <button className="btn btn-danger" onClick={confirmDelete} disabled={busy}>{t('set_delete_yes')}</button>
              <button className="btn btn-quiet" onClick={() => setConfirming(false)} disabled={busy}>{t('set_delete_no')}</button>
            </div>
          </div>
        )}
        {delProblem && <p className="field-error" role="alert">{err(delProblem)}</p>}
      </section>
    </main>
  );
}
