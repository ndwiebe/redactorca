# Self-hosting the detection assets (no-egress production)

RedactorCA's core promise is that client documents never leave the browser. The
enforcement is a `default-src 'self'` + `connect-src 'self'` CSP (see `public/_headers`):
the browser will refuse any outbound request to a third party. For that to hold, every
detection asset must be served from our own origin — never the Hugging Face / jsDelivr /
tessdata CDNs that the libraries reach for by default.

## What gets vendored

| Asset | Size | Source | Served at |
|-------|------|--------|-----------|
| NER model (`model_quantized.onnx` + tokenizer/config) | **178 MB** | Hugging Face `Xenova/bert-base-multilingual-cased-ner-hrl` | `/models/Xenova/…` |
| ONNX-runtime WASM + `.mjs` loaders (all `ort-wasm-simd-threaded.*` variants) | ~75 MB total | `node_modules/onnxruntime-web/dist` | `/ort/` |
| Tesseract worker + LSTM core + `eng.traineddata.gz` | ~23 MB | `node_modules/tesseract.js*` + tessdata | `/tesseract/` |

Wiring is in code:
- `src/names.ts` → `env.allowRemoteModels = false; env.localModelPath = '/models/'; env.backends.onnx.wasm.wasmPaths = '/ort/'`
- `src/ocr.ts` → `createWorker('eng', LSTM, { workerPath, corePath, langPath })` all under `/tesseract/`

`allowRemoteModels = false` is the load-bearing line: a missing local file throws
instead of silently falling back to the HF CDN.

## Local dev / CI

```bash
npm install            # postinstall runs fetch-assets automatically
npm run fetch-assets   # or run it manually
npm run dev
```

The assets land in `public/{models,ort,tesseract}` (all gitignored — too large to commit).
Verify by opening the app and watching the Network panel: **every request must be
same-origin.** Name detection and OCR should work with the network throttled to offline
after the first load.

## Production on Cloudflare Pages

The WASM + tesseract assets are small enough to ship as Pages static files (under the
25 MiB/file limit). **The 178 MB model is not** — it must come from R2, served
*same-origin* so the `connect-src 'self'` CSP still holds.

**Nathan's steps (the part that needs your Cloudflare account):**

1. **Buy the domain** — `redactorca.ca` (and/or `.com`); `redactor.ca` is taken.
2. **Create an R2 bucket** (e.g. `redactorca-models`) and upload the model tree:
   ```bash
   npm run fetch-assets   # populates public/models locally first
   npx wrangler r2 bucket create redactorca-models
   npx wrangler r2 object put redactorca-models/Xenova/bert-base-multilingual-cased-ner-hrl/onnx/model_quantized.onnx \
     --file public/models/Xenova/bert-base-multilingual-cased-ner-hrl/onnx/model_quantized.onnx
   # repeat for config.json, tokenizer.json, tokenizer_config.json, special_tokens_map.json
   ```
3. **Bind R2 to a same-origin route** so the model is served from our domain (not a
   public R2 URL — that would be a cross-origin fetch and break `connect-src 'self'`).
   Either a Pages Function at `functions/models/[[path]].ts` that streams from the R2
   binding, or an R2 custom-domain mapped under the site and added to the CSP. The
   Pages-Function route keeps the CSP a clean `'self'`.
4. **Create a scoped Cloudflare API token** (Pages + R2 edit) for CI deploys.
5. Deploy: `npm run build && npx wrangler pages deploy dist`. The `public/_headers` CSP
   ships automatically.

After deploy, confirm in DevTools that loading + redacting a document produces **zero**
cross-origin requests, and that the response carries the `Content-Security-Policy`
header. That network panel is the literal proof behind "nothing leaves your device."

> Vercel is disqualified — the Hobby plan forbids commercial/lead-gen use, and a paid
> plan loses the provable-no-egress story Pages gives for ~CAD$13–26/yr (domains only).
