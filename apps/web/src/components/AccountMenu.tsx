import { useEffect, useRef, useState } from 'react';
import { UI, pick, type Lang } from '../i18n';
import { firstName, initial, logOut, type Account } from '../account';

/**
 * The logged-in header button (M1): photo or initial, first name, and a small
 * menu with the full name, the address and "log out".
 *
 * ⚠️ `referrerPolicy="no-referrer"`: Google's photo server often refuses an
 * image request that says which site it came from. If the photo still fails,
 * the circle falls back to the initial instead of a broken-image icon.
 */
export function AccountMenu({ account, lang, onSettings }: { account: NonNullable<Account>; lang: Lang; onSettings: () => void }) {
  const t = (k: keyof typeof UI) => pick(UI[k], lang);
  const [open, setOpen] = useState(false);
  const [photoOk, setPhotoOk] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click anywhere else, or on Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const avatar = (size: 'sm' | 'lg') =>
    account.photo && photoOk ? (
      <img
        className={`avatar avatar-${size}`}
        src={account.photo}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setPhotoOk(false)}
      />
    ) : (
      <span className={`avatar avatar-${size} avatar-letter`} aria-hidden="true">{initial(account)}</span>
    );

  const first = firstName(account);

  return (
    <div className="acct-menu" ref={ref}>
      <button
        className="acct-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('acct_menu')}
      >
        {avatar('sm')}
        {first && <span className="acct-btn-name">{first}</span>}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="acct-drop" role="menu">
          <div className="acct-drop-who">
            {avatar('lg')}
            <div>
              {account.name && <p className="acct-drop-name">{account.name}</p>}
              <p className="small muted acct-drop-email">{account.email}</p>
            </div>
          </div>
          <button
            className="acct-drop-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
          >
            {t('acct_settings')}
          </button>
          <button
            className="acct-drop-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logOut();
            }}
          >
            {t('acct_logout')}
          </button>
        </div>
      )}
    </div>
  );
}
