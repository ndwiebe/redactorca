# Redactor█CA

**Use AI on client files. Keep their identities off the internet.**

RedactorCA strips Canadian client identity out of a document — in your browser, before you paste it into ChatGPT, Copilot, or Claude. Names, SINs, business numbers, bank accounts, addresses and more are swapped for **consistent labels** (`PERSON_1`, `SIN_2`) so the AI still understands who's who, while the real identities never leave your machine. Paste the AI's answer back in and the real names return.

Built for Canadian accountants and bookkeepers. No upload. No account. No server.

## Why this exists

Accountants are told two contradictory things: *use AI to work faster* and *never put client data in a public model*. The standard advice — "just redact it first" — is a manual find-and-replace chore where one missed identifier in a 30-page return is a confidentiality breach. RedactorCA automates that chore without creating a new place for client data to leak, because there is no backend to leak from.

## How it works

Everything runs client-side, in three layers:

1. **Deterministic patterns** (`src/patterns.ts`) — Canadian structured identifiers have fixed formats, so regex + checksums catch them regardless of document layout, including inside tables where language models go blind. Covers: SIN (Luhn-validated, plus label-anchored so even a mistyped SIN is caught), CRA Business Numbers with program accounts (RC/RT/RP/RZ, in any spacing), trust numbers, credit cards (Luhn), bank accounts and transit/institution coordinates, street addresses (English and French order), postal codes, emails, phones, provincial health numbers (OHIP/RAMQ/PHN), passports, and driver's licences.
2. **Neural name detection** (`src/names.ts`) — a multilingual NER model running in-browser via transformers.js (WASM). Detection runs on a whitespace-collapsed, case-normalized copy so names inside table columns and ALL-CAPS names (CRA slips mandate capital surnames) are caught, then located back in the original text.
3. **Document readers** — PDFs via pdf.js, Word documents via mammoth, and scans/photos via tesseract.js OCR. All in-browser, all lazy-loaded.

**Dollar amounts are kept on purpose.** You're sending the document to an AI to analyze the numbers — the tool strips *who it belongs to*, not the figures.

**Consistent pseudonymization, not black bars.** Every distinct entity gets one stable token reused everywhere. The token↔original map stays on your machine and powers the round-trip: paste the AI's reply and the tokens turn back into real values.

## Verify the privacy claim yourself

- The detection engine (model weights, OCR engine) downloads once on first use, then is cached. Your documents are never in any request — watch the Network tab while you redact.
- There is no server, no account, no analytics, and no telemetry on this page.
- The code is open. Read it.

## Development

```bash
npm install
npm run dev        # local dev server
npx vitest run     # 29 tests, including a real-document corpus regression
npx tsc            # typecheck
npm run build      # production build
```

### The corpus regression suite

`test/fixtures/corpus-*.md` holds 24 realistic Canadian document samples (CRA slips, pay stubs, bank statements, invoices, cheques) with ground-truth answer keys, assembled from public specimen forms — **all data is synthetic**. `src/corpus.test.ts` locks in two guarantees: dollar amounts are never redacted, and structured-PII recall stays ≥ 80%.

## Status

Active development. The web app works today; deployment, a strict no-egress CSP (self-hosted models), and a browser-extension companion are on the roadmap.

## License

[MIT](LICENSE). The name-detection model ([bert-base-multilingual-cased-ner-hrl](https://huggingface.co/Davlan/bert-base-multilingual-cased-ner-hrl), AFL-3.0) is fetched from Hugging Face at runtime and is not distributed with this repository.
