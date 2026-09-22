# Photographing the states

Not part of the app and not shipped. These exist because M5 needed proof of
states that no test can show and `chrome --headless --screenshot` cannot
capture: that flag waits for the page to finish loading, and a page that is
genuinely waiting never does. So drive the browser instead.

Start a headless Chrome once and leave it running:

```
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new \
  --disable-gpu --hide-scrollbars --remote-debugging-port=9222 \
  --user-data-dir=<a temp dir> --no-first-run about:blank
```

Node 24 has `WebSocket` built in, so none of this needs a library.

| File | What it photographs |
|---|---|
| `shot.mjs <url> <out.png> [w] [h] [waitMs] [full]` | Any screen. Navigates **without awaiting**, so a pending page is captured mid-wait |
| `hang.py` | A server on 3099 that accepts the connection and never answers. With `VITE_API_BASE=http://localhost:3099 npx vite --port 5180 --strictPort`, the app is genuinely waiting. Port 3098, with nothing on it, gives the failure state |
| `working.mjs <out.png>` | The line saying the engine is running. Real API, `Network.emulateNetworkConditions` at 6s latency, then tick a step |
| `alldone.mjs <out.png>` | A finished road. Ticks every step, one real engine run each |
| `paper.mjs <out.pdf>` | The printed sheet, via `Page.printToPDF`. Render pages and measure where the last line of text falls with PyMuPDF (`fitz`) — that is how the blank pages were found |

⚠️ The API allows origins `localhost:5173`, `5174`, `127.0.0.1:5173` only
(`apps/api/src/app.ts` → `ALLOWED_ORIGINS`). A second `npm run dev:web` lands
on 5175 and every fetch is silently blocked by CORS: the page just sits on the
welcome screen and nothing says why. Vite binds IPv6, so `curl 127.0.0.1:5173`
returns nothing while `localhost:5173` works.
