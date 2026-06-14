# RedactorCA — Session Handoff

_Last updated: 2026-06-14. Read this first when resuming; it captures state a fresh session won't otherwise know._

## What this is
A 100%-client-side, Canadian-tax-aware PII redactor for CPAs. Strips client identity out of a document **in the browser** so it's safe to paste into ChatGPT/Copilot/Claude. **Dollar amounts are kept on purpose** (the AI still needs the numbers). Re-identify loop maps tokens back to real values locally. Vite + vanilla TypeScript, no framework.

**Three detection layers:**
1. `src/patterns.ts` — deterministic regex/checksum layer (SIN, BN, credit card, bank, postal, email, phone, health, passport, DL, address) + form-field PERSON/ORG capture. Runs on full text (no length limit).
2. `src/names.ts` — neural NER (transformers.js BERT) for PERSON/ORG names. **Now chunks long docs** (was truncating at ~512 tokens).
3. `src/main.ts` `loadFile()` — format readers: PDF (pdf.js, text + OCR fallback), DOCX (mammoth), **Excel (SheetJS)**, images (tesseract OCR), CSV/text.

## Git state (as of handoff)
- Branch `main`, **1 commit ahead of `origin/main`** — `df6dfdf` (provincial health labels) is **committed but NOT pushed**. Everything else is pushed (origin at `172473e`).
- 34/34 tests pass (`npx vitest run`), `tsc --noEmit` clean.
- Only untracked: `test-docs/` (synthetic test files — intentionally not committed).
- **Push needs Nathan's explicit go-ahead each time** (global rule).

## What this session did (newest first)
- `df6dfdf` **Provincial health labels** — MCP/HSN/MSI/NS/PE/Medicare. (unpushed)
- `172473e` **Excel support** — SheetJS, client-side; emits `Header: value` per cell so column headers act as PII labels (catches checksum-less PII in columns).
- `34b0528` **Long-document fix** — NER runs over overlapping ~220-word windows so names past page one aren't dropped. *(The single most important fix — it was silently leaking every name past ~512 tokens.)*
- `fb9f629` **No-egress prep** (R2-gated, inert) — see "Blocked" below.
- `3e622db` numbered-company names; `7a3e7f0` labeled-SIN worded/multiline gap; `beb0dfd` real-document leak fixes (OHIP newline, DL province qualifier, passport, label-anchored credit card, form-field PERSON/ORG) + the accuracy harness; `98009be` ORG detection + directional suffixes.

## Trust verdict (from the 6-doc, 425-item stress test — the evidence)
**Structured Canadian identifiers (SIN/health/BN/bank/card/DL) are caught reliably across long, multi-format documents.** That's the defensible claim. Honest residuals:
- **Alphanumeric account/plan IDs** (RRSP plan #, Sun Life contract `0291-447-LK`, Wealthsimple `WS-7741-22018`, dashed `1234-56-7890`) — not modeled by the numeric bank patterns. **Real gap.**
- **Names in free prose** — neural misses some hyphenated/accented surnames + org brands (Tangerine, Wealthsimple, Hydro-Québec). Strong on labeled fields, imperfect in sentences. **Known soft spot — mitigated by the planned review UI.**
- Cities/provinces are **kept by design** (not leaks).
- Leaked SINs in the test were all **Luhn-invalid test values** — a real SIN is caught (checksum if unlabeled, label if checksum fails). Verified.

## Next steps (prioritized)
1. **Push `df6dfdf`** (waiting on Nathan).
2. **Labeled account/plan/policy/contract-number recognizer** — closes the alphanumeric-ID gap above.
3. **"Show your work" review-before-copy UI** — per-category found-counts + a review step + honest limits note. This is the **biggest trust lever** and the mitigation for prose-name misses. (Vault calls trust the #1 gate to distribution.)
4. Quick look at the one DL that leaked in the stress test (`T2491-180462-08`) — likely a label-phrasing gap.
5. **Distribution (unblocked, vault's #1 strategic item):** GEO/SEO fear-query content ("Is it safe to put client data in ChatGPT? — a Canadian CPA's guide") + a gated PIPEDA acceptable-use policy lead-magnet, on a **separate marketing origin** (never on the tool). Anchor on the OPC May-2026 PIPEDA ruling + CRA IC05-1 data-residency.

## Blocked (needs Nathan, not code)
**No-egress production lockdown** (`SELF-HOST.md`). The "nothing leaves your device" claim is honest today (model downloads once from HF CDN, documents never leave) but not yet provable via a `default-src 'self'` CSP. Prep is done (`scripts/fetch-assets.mjs`, `public/_headers` with a DO-NOT-DEPLOY note, vendored assets). Blocked because the **178 MB model exceeds Cloudflare Pages' 25 MB/file limit → needs R2**, which needs:
- Buy `redactorca.ca` (`.com` also free; `redactor.ca` is taken).
- Create a Cloudflare R2 bucket + a scoped API token.
- Then: debug the local-model inference (it loads with zero egress in a prod build but currently returns 0 names — unresolved), flip `names.ts`/`ocr.ts` to local paths, activate the CSP. Vercel is disqualified (Hobby forbids commercial use).

## Environment gotchas (will bite a fresh session)
- **Dev server / IPv4-IPv6 collision:** DisplayMyCard's Vite squats `*:5173`; RedactorCA's dev server is on `[::1]:5173`. In `dev-browser`, navigate to **`http://[::1]:5173`** (plain `localhost` resolves to IPv4 → loads the wrong app). Start with `npm run dev`.
- **Testing the full pipeline needs the browser.** `npx vitest run` (the `src/accuracy.test.ts` harness) only exercises the **regex layer** (`detectPatterns`). The neural NER + file readers + OCR must be verified via `dev-browser --connect` against the running app. Click **"Detect names"** to load the model (CDN, then browser-cached).
- **Inject a file in dev-browser** (sandbox blocks `setInputFiles` from arbitrary paths): base64 the file → `readFile` it in the script → build a `File` from the bytes → set `#file.files` via a `DataTransfer` → dispatch a `change` event. (`#input` = textarea, `#output` = redacted pane, `#summary` = counts, `#status-line` = status.)
- **Test assets:** synthetic docs in `test-docs/` (untracked). The stress corpus + manifests are at `~/.dev-browser/tmp/stress-corpus.json`.
- **SheetJS** is installed from the SheetJS CDN tarball (patched 0.20.3), NOT npm (npm release has CVEs). Don't "fix" it to the npm version.
- **Vendored no-egress assets** (`public/{models,ort,tesseract}`) are gitignored — run `npm run fetch-assets` to repopulate locally.

## Hard constraints (do not break)
- 100% client-side. **No Sentry/PostHog/analytics on the tool** — it would break the privacy promise.
- Keep dollar amounts + tax line numbers (the precision gate; `accuracy.test.ts` enforces amount/line precision = 1.000).
- TypeScript strict, no `any`. No `console.log` in shipped `src/` (the metric harness test file may log).
- Commits as `Nathan Wiebe <dominathan@gmail.com>`. Push to `main` only with Nathan's explicit OK.

## Key files
`src/patterns.ts` (regex + form-field PERSON/ORG) · `src/names.ts` (NER + chunking) · `src/ocr.ts` · `src/main.ts` (`loadFile` readers) · `src/accuracy.test.ts` (3-stratum harness, 100% gated) · `test/fixtures/seed-failures.json` (frozen corpus) · `LOOP-CHARTER.md` + `LOOP-LOG.md` (accuracy-loop protocol/log) · `SELF-HOST.md` (no-egress deploy) · `public/_headers` (prod CSP, inert) · `scripts/fetch-assets.mjs`.

## Vault references
`~/jarvis-memory/05-SlabSavvy-AI-Consulting/2026-06-11-redactor-ca-*` (competitor landscape, buildout plan, funnel, browser-extension architecture). Builder-journal entries for this work: `~/jarvis-memory/career/builder-journal.md` (2026-06-13 / 2026-06-14).
