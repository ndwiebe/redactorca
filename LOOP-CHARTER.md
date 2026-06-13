# RedactorCA — Accuracy-Convergence Loop Charter

This is the protocol the `/ralph-loop` self-improvement loop executes once per iteration.
The loop re-feeds a short prompt that says *"read this file and run one iteration."* All the
real instruction lives here so it is version-controlled and can be edited between runs.

> [!important] Read this whole file before acting. Then do EXACTLY ONE iteration of the
> protocol in section 5, then either emit the completion promise (section 6) **only if it is
> literally true** or stop so the loop re-feeds you for the next iteration.

---

## 1. The goal, stated honestly

We want the redactor to be "100% accurate on all variations and formats." That sentence,
taken literally, is **not a stoppable goal**: the space of possible inputs is infinite, there
is no oracle for "all variations," and a loop chasing it either runs forever or tempts you to
falsely declare victory. So we make it measurable and convergent instead.

**Accurate = on a frozen, versioned, three-stratum test corpus:**
- **(A) it never leaks PII on clean, realistic Canadian documents** (the hard gate), and
- **(B) it never redacts kept data — dollar amounts, tax line numbers** (the equal-weight guardrail), and
- **(C) it survives common copy-paste/OCR mangling** (a tracked target, not a hard gate).

"100% on all inputs" is replaced by "**zero regressions and zero new failures for two
consecutive iterations** on a corpus that grows adversarially every round." That is the only
form of the goal you can truthfully assert you have reached.

---

## 2. The frozen corpus (build it in iteration 1, never weaken it)

Create a permanent accuracy harness and three labeled strata. Seed them from
`test/fixtures/seed-failures.json` (99 real leaks/over-redactions from the 2026-06-13
adversarial probe) **plus** the existing `test/fixtures/corpus-*.md`.

```
test/fixtures/strata/clean.json        # stratum A — realistic ASCII docs, every PII span labeled
test/fixtures/strata/precision.json    # stratum B — kept-data values that must NOT be redacted
test/fixtures/strata/adversarial.json  # stratum C — unicode-evasion + OCR-degraded variants
src/accuracy.test.ts                   # the harness: prints a machine-readable METRIC REPORT
```

Each case: `{ "input": "...", "expect": "<PII substring>"|null, "shouldNotDetect": "<kept value>"|null, "category": "...", "stratum": "A|B|C" }`.
The harness runs `detectPatterns` (and, where feasible in Node, the full pipeline) over every
case and prints between `METRIC_REPORT_START` / `METRIC_REPORT_END`:

```
A_recall=<masked/expected>  A_leaks=[...]
B_precision=<1 - overredactions/kept>  B_amount_taxline_precision=<must be 1.000>  B_violations=[...]
C_unicode_recall=<...>  C_ocr_recall=<...reported, not gated...>
per_category_leaks={SIN:n, BN:n, ...}
```

**Integrity rules for the corpus (these make the promise meaningful):**
- A frozen case is **append-only**. You may ADD cases; you may NEVER delete one, weaken its
  `expect`, or relax a threshold to make a run pass.
- Every iteration must ADD at least 5 new adversarial cases across axes not yet covered
  (this is the loop-until-dry engine — the corpus must get harder, not easier).
- The harness must use **exact** span matching for stratum A (no lenient `includes()` that
  scores a partial mask as a hit — the old `corpus.test.ts` norm() hid the DL 17-char bug).

---

## 3. The gates (what "passing" means each iteration)

| Gate | Stratum | Threshold | Type |
|------|---------|-----------|------|
| **A** clean-ASCII recall | A | `A_leaks == 0` (recall = 1.000) | **HARD** — must hold to converge |
| **B** precision | B | overall precision ≥ 0.98 **AND** dollar-amount + tax-line precision = 1.000 | **HARD regression gate, every iteration** |
| **C** unicode-evasion recall | C | ≥ 0.95 | target (escalate, don't burn budget) |
| **C** OCR-homoglyph recall | C | measured + reported | **NOT gated** — out of regex scope (belongs to OCR/neural stage) |

> [!warning] The dangerous failure mode of a recall-only loop is **widening a regex to catch a
> leak and silently creating an over-redaction** (e.g. uncapping account length, adding the
> passport `i` flag, broadening a separator class). Gate B is therefore checked on EVERY
> iteration with equal weight: **reject any change that fixes an A-leak while regressing B
> below its threshold**, even if A improves. Never blend A and B into one F1 score — that lets
> recall gains hide precision losses.

---

## 4. Seed failure catalog (priority order for the early iterations)

From the empirical probe. Full data in `test/fixtures/seed-failures.json`. Highest-leverage first:

**Tier 1 — clean-input leaks of canonical real formats (fix these before any "accurate" claim):**
1. **DL 17-char cap** — `D2300-40021-77100` (canonical ON/QC licence) leaks because the DL value class caps at 15 chars. Highest severity: it leaks the *most common* Canadian licence format outright.
2. **Bank account 5-3-12 cap** — `12345-003-1234567890` leaks; the dashed-form regex caps the account group at 7 digits — that's the tool's *own headline* void-cheque format.
3. **Unseparated 10-digit phone** — `6045550199` (standard spreadsheet/export form) leaks; the regex mandates a separator.
4. **BN missing program letters** — `RM/RR/RD/RN/RG` (charity/import/excise) leak; hard-coded to `R[CTPZ]`. The program-account suffix is never redacted.
5. **HEALTH missing labels** — `PHIN`, `AHCIP`, `Medicare`, and **all French** labels (`assurance maladie`); plus body length cap `{5,11}` truncates fully-spaced 10-12 digit numbers (tail leak).
6. **Lowercase passport** — `ab123456` leaks (no `i` flag).
7. **~13 missing/accent-sensitive street types** — `Grove/Mews/Loop/Manor/...`; FR list is accent-sensitive (`Allee/Montee/Cote` miss); rural routes (`RR 3`) and Quebec ordinal grids (`3e Rue`) unrecognized.

**Tier 2 — the single highest-leverage cross-cutting fix (closes ~39 leaks at once):**
- A **normalization pre-pass** run before detection, against an **offset map** so spans still
  point at the original text: NFKC fold (fixes fullwidth digits `０４６`), strip zero-width
  chars (U+200B), map non-breaking space U+00A0 / narrow-NBSP and unicode dashes
  (U+2010/2011/2013) to ASCII. NBSP in particular is **not an attack** — it's the default space
  when pasting tables from Word/PDF/fr-CA tax slips. This is stratum C's main lever.
- Relax separator alphabets where a **label already gates false positives**: SIN/BN/health
  label-anchored branches can safely accept dots, slashes, and doubled spaces.

**Tier 3 — over-redaction guards (these protect gate B; do them WITH tier-1 widening):**
- Credit card: a Luhn-coincident 16-digit GL/invoice ID (`9876543210123452`) is flagged as a card. Add a BIN-prefix sanity guard.
- Bank dashed-form: `2024-003-0000125` (an invoice) redacted — no checksum/context gate.
- Passport unanchored shape flags invoice/SKU `AB123456` — require a label or stronger context when unanchored.

**Out of scope (do NOT chase with regex — escalate instead):**
- OCR homoglyph substitution (`O`→`0`, `S`→`5`, `l`→`1` *inside* a number), `@`→`a`, dot→space
  in an email domain. Broadening `\d` to accept letters would breach gate B. These belong to
  the OCR/neural stage, not `patterns.ts`.

---

## 5. Per-iteration protocol (do these in order, ONCE)

1. **Read the metric report.** Run `npx vitest run src/accuracy.test.ts` and read the
   `METRIC_REPORT`. (Iteration 1: first build the harness + strata from section 2, seeded from
   `seed-failures.json` + existing corpus, then run it.)
2. **Check regressions first.** Compare to the previous iteration's report (kept in
   `LOOP-LOG.md`). If gate B regressed, your last change was net-negative — **revert or correct
   it before anything else.**
3. **Pick the single highest-severity open failure** (tier order in section 4; A-leaks before
   C-targets always).
4. **Fix it in `src/patterns.ts`** (or add the normalization pre-pass). Make the *smallest*
   change that closes it without widening the false-positive surface. Prefer fixing the
   label-anchored branch (the label gates FPs) over the unlabeled branch.
5. **Add ≥5 new adversarial cases** to the strata covering variations adjacent to what you just
   fixed AND at least one axis not yet stressed (grow the corpus).
6. **Re-run the harness.** Confirm: the targeted leak is closed, gate B did not regress, and the
   existing 31-test suite (`npx vitest run`) is still green, `npx tsc --noEmit` clean.
7. **Append to `LOOP-LOG.md`:** iteration number, the metric report, what you fixed, what you
   added, and any failure you've decided is out-of-scope (with reason).
8. **Commit** (`fix(patterns): <leak closed> [loop iN]`) so progress is reproducible and the
   promise is backed by real committed state. Then evaluate section 6.

---

## 6. Convergence & the completion promise

You may emit the promise **only when ALL of these are literally true, verified by a metric
report you regenerated in THIS iteration:**

- `A_leaks == 0` (clean-ASCII recall = 1.000), and
- gate B passing: overall precision ≥ 0.98 with dollar-amount + tax-line precision = 1.000, and
- `C_unicode_recall ≥ 0.95`, and
- **no metric regressed** versus the previous iteration, and
- **the above held for the previous iteration too** (two consecutive clean, non-regressing rounds), and
- the full `npx vitest run` suite is green, `tsc --noEmit` clean, and the state is committed.

When and ONLY when every bullet is true, output exactly:

```
<promise>REDACTOR ACCURACY CONVERGED: clean-ASCII recall 1.000 zero-leak, precision gate held (amounts and tax lines 1.000), unicode-evasion recall at or above 0.95, stable and non-regressing across two consecutive committed iterations.</promise>
```

**Do not output that string for any other reason.** Not because you think you're stuck, not to
escape, not "close enough." The loop is designed to keep going; a false promise is the one
unforgivable move (it ships a privacy tool that leaks).

### Terminal-but-not-converged (legitimate escalation)
If you reach the `--max-iterations` cap, OR you hit a state where `A_leaks == 0` and gate B
passes but `C_unicode_recall` is stuck below 0.95 because the remaining gap is the normalization
pre-pass / neural layer rather than regex tuning — **do NOT emit the promise.** Instead, in your
final message, write `LOOP TERMINAL — NOT CONVERGED` and list: the remaining failures, why each
is out of regex scope, and the recommended next step (usually: implement the normalization
pre-pass, or push the case to the neural/OCR stage). A flagged honest stop beats a false
"converged."

---

## 7. Hard integrity rules (summary)
- Never weaken, delete, or skip a frozen corpus case. Append-only.
- Never lower a threshold to pass. The thresholds in section 3 are fixed.
- Never trade a recall fix for a precision regression (gate B is equal-weight, every round).
- Never claim accuracy on "all inputs" — only on the frozen corpus.
- Never `console.log` in shipped `src/` (the project rule); the harness test file may log its METRIC_REPORT.
- TypeScript strict, no `any`. Keep the client-side / zero-network promise intact (no new deps that phone home).
- The promise must be backed by a committed, reproducible run. No promise without a fresh green metric report in the same iteration.
