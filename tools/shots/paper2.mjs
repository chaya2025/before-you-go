// The printed sheet, with the beforeprint unfolding that the rows now need.
import { writeFileSync } from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = await (await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
send('Page.navigate', { url: 'http://localhost:5173/?demo=roadmap' });
await sleep(7000);
// printToPDF does not fire beforeprint, so fire the app's own handler the way
// the browser would when the person presses the button on the page.
console.log('folded before:', await ev(`document.querySelectorAll('details:not([open])').length`));
await ev(`window.dispatchEvent(new Event('beforeprint'))`);
await sleep(400);
console.log('folded after :', await ev(`document.querySelectorAll('details:not([open])').length`));
const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
writeFileSync(process.argv[2], Buffer.from(pdf.result.data, 'base64'));
console.log('wrote', process.argv[2]);
process.exit(0);
