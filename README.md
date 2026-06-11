# RedactorCA

Local-first, Canadian-tax-aware PII redaction for accountants. Strip client
identity out of a document **in your browser** before pasting it into ChatGPT /
Copilot / Claude. Nothing is uploaded — there is no backend.

## Why
The #1 reason firms block AI on client work is data residency. RedactorCA runs
100% client-side (no server, no storage), so the redaction step never sends data
anywhere. You paste in a working paper, it strips the identifiers, you copy out
clean text. Dollar amounts are **kept** by design — you want the AI to see the numbers.

## Status (v0.1)
- ✅ Deterministic Canadian pattern layer: SIN (Luhn-checked), Business Number +
  program accounts (RC/RT/RP/RZ), trust #, credit card (Luhn), bank account,
  postal code, email, phone. Catches IDs **inside tables** (where neural models leak).
- ✅ UI: paste/drop, category toggles + presets (Payroll / Corporate / T1),
  highlighted preview, click-to-toggle any span, copy / download, trust indicator.
- ⏳ In-browser PDF text extraction (pdf.js) — next.
- ⏳ Neural name detection (transformers.js Privacy Filter, on reflowed text) — next.

## Dev
```
npm install
npm run dev      # local
npm test         # vitest (pattern-layer tests)
npm run build    # static output in dist/ — deploy anywhere (Cloudflare Pages / Vercel)
```

Research + architecture: see `~/jarvis-memory/05-SlabSavvy-AI-Consulting/2026-06-11-*`.
