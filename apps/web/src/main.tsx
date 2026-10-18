import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import { App } from './App';
import { LoginDone } from './components/LoginDone';
import { LOGIN_DONE } from './account';

// ⚠️ The Google popup lands here (D-193). It must NOT run the site: a second
// copy of the app would carry the guest's answers over a second time.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === LOGIN_DONE ? <LoginDone /> : <App />}
  </StrictMode>,
);
