// Walk the whole road: tick every step, one real engine run each, and
// photograph the screen a person sees when there is nothing left.
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
await sleep(6000);

for (let i = 0; i < 40; i++) {
  const left = await ev(`(() => {
    const box = [...document.querySelectorAll('.step-tick input')].find(b => !b.checked && !b.disabled);
    if (!box) return 0;
    box.click();
    return 1;
  })()`);
  if (!left) break;
  await sleep(700);
}
await sleep(1500);
console.log(await ev(`JSON.stringify({
  unticked: [...document.querySelectorAll('.step-tick input')].filter(b => !b.checked).length,
  ticked: [...document.querySelectorAll('.step-tick input')].filter(b => b.checked).length,
  nowNote: (document.querySelector('.road-part-now .road-part-note')||{}).textContent||null,
  doneOpen: (document.querySelector('.road-part-done')||{}).open ?? null,
  laterPart: !!document.querySelector('.road-part:not(.road-part-now):not(.road-part-done)'),
})`));
await ev(`window.scrollTo(0,0)`);
await sleep(400);
const s = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(process.argv[2], Buffer.from(s.result.data, 'base64'));
console.log('wrote', process.argv[2]);
process.exit(0);
