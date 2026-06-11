# RedactorCA — production roadmap (front to back)

Status: v0.1 prototype shipped (pattern layer + marketed UI, 100% client-side).
Goal: a production-worthy, launch-ready product. "Back" = the detection engine +
build/deploy/distribution; there is deliberately no server.

Principle that gates every decision: **the local-first promise is the product.**
Anything that would send a byte of client data off the machine is disqualified,
including conveniences (cloud OCR, webfont CDNs, analytics that see content).

---

## Phase 1 — Detection engine complete ("it actually catches everything")
The bar: a CPA can throw a real working paper, a scanned receipt, or a PDF at it
and trust the redaction.

- **1a. Finish the Canadian taxonomy.** Add provincial health numbers (OHIP 10+version, AB/BC PHN 9, 7–12 range), driver's licence (per-province formats), passport (2 letters + 6 digits), ITN. Already have: SIN+Luhn, BN/program accounts, trust #, credit card+Luhn, bank account, postal, email, phone. Expand the test corpus alongside.
- **1b. Neural name detection.** Lazy-load the Privacy Filter (transformers.js, in-browser, WASM/WebGPU) for PERSON names — the one category regex can't do. Run it on **reflowed-to-prose** text so names in tables are caught (the table-leak fix from the eval). Regex-only mode stays instant with zero download; the model loads on demand with a progress bar.
- **1c. Read PDFs + scans in-browser.** pdf.js for born-digital PDF text (no OCR, instant). tesseract.js (or LiteParse-WASM) for scanned/photo docs. All local.
- **1d. Quality + corpus.** A synthetic but realistic test set (working papers, T4/T5/T3 snippets, a scanned receipt) with expected-redaction assertions, so detection quality is measured, not assumed. Confidence surfaced in the UI.

## Phase 2 — Launch-ready UX
The bar: feels finished, fast, and safe to a non-technical CPA.

- **Offline-first PWA.** Service worker so it works with no connection after first load (reinforces "local"); installable.
- **Model-download progress** + graceful first-run (the names model is tens of MB; show it, cache it).
- **More inputs/outputs.** .docx (mammoth.js) + .csv; **redacted-PDF output** (re-render with real bars), not just text.
- **Review flow.** Bulk accept/reject, keyboard navigation, "reveal all / re-redact all," count of what's hidden.
- **States + persistence.** Empty / loading / error (bad file, too large, model failed) states; remember presets/toggles in localStorage.
- **Onboarding.** A one-click "try it on a sample working paper" so the value lands in 5 seconds.
- **Audits.** Full a11y pass + performance (bundle split, lazy model, Lighthouse).

## Phase 3 — Distribution & enforced trust
The bar: a stranger can verify the privacy claim themselves.

- **Deploy** to Cloudflare Pages (static) + a domain.
- **Enforced no-egress (the differentiator).** Ship a Content-Security-Policy with `connect-src 'none'` (and no `form-action` posting) so the page is **physically unable to make a network request**. "Nothing leaves your machine" becomes browser-enforced, not promised — and we say so on the page. (Model files load from same-origin, bundled; CSP allows `self` only for those.)
- **Trust page.** Plain-language privacy explanation + how to verify (open Network tab). Terms.
- **SEO / landing polish**, OG image (the redaction-bar hero).
- **Analytics:** none that see content. If any, privacy-preserving + page-view only, or skip.

## Phase 4 — Monetization & editions (needs Nathan's calls)
- **Free vs Pro.** Candidate Pro features: reversible redaction (re-identify the AI's answer), batch/folder, redacted-PDF export, the full neural model. Free = the core single-doc text redaction.
- **Charging with no backend.** Stripe Checkout → license key; verify the key client-side (or via one tiny serverless function that only sees the key, never content).
- **Tax Playbook tie-in.** Lead magnet → tool → Pro.
- **Desktop edition.** Wrap the same web app in Tauri for install-once/offline.

---

## Decisions for Nathan (don't block Phase 1 engineering)
1. **Monetization model:** free lead-magnet (grow the brand / Tax Playbook funnel), freemium (free core + paid Pro), or paid from day one?
2. **v1 launch scope:** soft-launch after Phase 2 (working tool, your own use + a few CPAs), or hold for Phase 4 (paid)?
3. **The CSP no-egress lockdown** (Phase 3) — adopt it as the headline trust feature? (Strong yes from me; it's a real moat.)
4. **Desktop edition** — Phase 4, or not needed if the PWA installs cleanly?

## Sequencing
Phase 1 → 2 → 3 are mostly invariant to the business decisions, so I iterate those now. Phase 4 waits on #1–#2.
