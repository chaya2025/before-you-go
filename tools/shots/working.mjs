import { writeFileSync } from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = await (await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable');
send('Page.navigate', { url: 'http://localhost:5173/?demo=roadmap' });
await sleep(6000);
await send('Network.emulateNetworkConditions', { offline: false, latency: 6000, downloadThroughput: 20000, uploadThroughput: 20000 });
await ev(`(() => { const b = document.querySelector('.step-tick input'); b.scrollIntoView({block:'center'}); b.click(); return true; })()`);
await sleep(1500);
console.log(await ev(`JSON.stringify({
  rowSays: (document.querySelector('.step-tick-busy span')||{}).textContent||null,
  allTicksDisabled: [...document.querySelectorAll('.step-tick input')].every(i => i.disabled),
  topLine: !!document.querySelector('.working'),
})`));
const s = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(process.argv[2], Buffer.from(s.result.data, 'base64'));
console.log('wrote', process.argv[2]);
process.exit(0);
