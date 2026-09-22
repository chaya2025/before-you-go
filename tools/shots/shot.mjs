// CDP screenshotter. Needed because --screenshot waits for the page to finish
// loading, and a page that is genuinely waiting on a request never does.
// Args: <url> <out.png> [width] [height] [waitMs] [fullPage]
import { writeFileSync } from 'node:fs';

const [url, out, w = '1280', h = '1400', waitMs = '4000', full = '1'] = process.argv.slice(2);
const port = process.env.CDP_PORT || '9222';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(list.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) =>
  new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Emulation.setDeviceMetricsOverride', {
  width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 600,
});
await send('Page.enable');
send('Page.navigate', { url });          // deliberately not awaited: it may never settle
await sleep(+waitMs);

let clip;
if (full === '1') {
  const { result } = await send('Page.getLayoutMetrics');
  const cs = result.cssContentSize;
  clip = { x: 0, y: 0, width: Math.ceil(cs.width), height: Math.ceil(cs.height), scale: 1 };
  if (clip.height > 16000) clip.height = 16000;
}
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full === '1', ...(clip ? { clip } : {}) });
if (!shot.result || !shot.result.data) { console.error(JSON.stringify(shot)); process.exit(1); }
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('wrote', out);
ws.close();
process.exit(0);
