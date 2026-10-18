import { useEffect, useState } from 'react';
import { getAccount } from '../account';
import { UI, pick } from '../i18n';

/**
 * ⭐ The Google popup's last page (D-193). Supabase finishes the login from the
 * address on its own; once there is an account, the window closes and the
 * page he was on carries on, logged in, with everything he filled.
 */
export function LoginDone() {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'he';
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getAccount().then((a) => (a ? window.close() : setFailed(true)));
  }, []);
  return (
    <main className="login-done" dir={lang === 'he' ? 'rtl' : 'ltr'} style={{ padding: 24, textAlign: 'center' }}>
      <p>{pick(failed ? UI.login_done_failed : UI.login_done, lang)}</p>
    </main>
  );
}
