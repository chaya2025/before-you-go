import { writeFileSync } from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = await (await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.enable'); await send('Runtime.enable');
send('Page.navigate', { url: 'http://localhost:5173/?demo=roadmap' });
await sleep(7000);
const data = await ev(`(() => {
  const clean = (s) => (s||'').replace(/\s+/g,' ').trim();
  const strip = (s) => clean(s).replace(/^(לבדוק לפני|לוודא|ממתין ל|נדרש ב|להביא|עלות|למה דווקא הוא)\s*:\s*/,'');
  const standing = [...document.querySelectorAll('.answer-side .note-list summary')].map(e => strip(e.textContent));
  const stepLines = [];
  document.querySelectorAll('.step').forEach((st, i) => {
    st.querySelectorAll('p, li, summary, strong').forEach(n => {
      const txt = clean(n.textContent);
      if (txt.length > 10) stepLines.push({ step: i+1, txt, stripped: strip(txt) });
    });
  });
  // how much of each step is a restatement of a standing condition
  const echoes = stepLines.filter(l => standing.some(s => s && (l.stripped.includes(s) || s.includes(l.stripped))));
  // the readiness card's first action vs step 1
  const fa = document.querySelector('.first-action');
  return JSON.stringify({
    standing,
    echoes: echoes.map(e => ({ step: e.step, txt: e.txt })),
    firstActionChars: fa ? clean(fa.textContent).length : 0,
    readinessChars: clean((document.querySelector('.answer-main > section')||{}).textContent||'').length,
    sideChars: clean((document.querySelector('.answer-side')||{}).textContent||'').length,
    pageHeight: document.body.scrollHeight,
  }, null, 1);
})()`);
writeFileSync(process.argv[2], data);
console.log('ok');
process.exit(0);
