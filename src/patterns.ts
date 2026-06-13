// Canadian PII pattern-redaction layer — the deterministic, layout-independent core.
// Runs 100% in-browser. No network, no dependencies.
//
// This is the "load-bearing" layer from the eval work: structured identifiers
// have fixed formats, so regex + checksums catch them regardless of document
// layout — including inside tables, where the neural model goes blind.
// Grounded in: PIPEDA sensitive-info categories, CRA program-account structure,
// CPA banking formats. See vault: 2026-06-11-redaction-tool-product-research.md

export type Category =
  | 'SIN'
  | 'BN' // CRA Business Number + program account (RC/RT/RP/RZ)
  | 'TRUST' // trust account number (T + 8)
  | 'CREDIT_CARD'
  | 'BANK_ACCOUNT'
  | 'ADDRESS' // civic street address (number + street name + type)
  | 'POSTAL'
  | 'EMAIL'
  | 'PHONE'
  | 'HEALTH' // provincial health number (labelled, since 9-digit shape collides with SIN)
  | 'PASSPORT' // Canadian passport: 2 letters + 6 digits
  | 'DL' // driver's licence (labelled — formats vary wildly by province)
  | 'PERSON' // filled by the neural layer, not here
  | 'ORG'; // organisation names — also filled by the neural layer

export interface Span {
  start: number;
  end: number;
  category: Category;
  text: string;
  /** 'pattern' = deterministic (this module); 'neural' = NER model. */
  source: 'pattern' | 'neural';
  /** 0..1 — pattern hits with a checksum are 1.0; weaker shape matches lower. */
  score: number;
}

/** Luhn checksum — used to validate SINs and credit-card numbers (cuts false positives hard). */
export function luhnValid(digits: string): boolean {
  const d = digits.replace(/\D/g, '');
  if (d.length < 9) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

interface Recognizer {
  category: Category;
  re: RegExp;
  /** optional validator on the raw match; return false to reject. */
  valid?: (m: string) => boolean;
  score: number;
}

// Street address: civic number + street name + street-type token. Handles both
// English order (name then type: "88 Wellesley St E") and French order (type
// then name: "4521 Rue Sainte-Catherine"). The type list is deliberately CURATED
// to exclude words that collide with financial vocabulary ("Line 150",
// "Common shares", "Run rate") — over-claiming an amount or a tax line would
// break the keep-the-financials promise. 'i' + \p{L} so ALL-CAPS / OCR / accented
// addresses all match.
const ADDRESS_RE = (() => {
  const en = 'Street|St|Avenue|Ave|Av|Road|Rd|Boulevard|Blvd|Boul|Drive|Dr|Crescent|Cres|Court|Crt|Ct|Place|Pl|Lane|Ln|Terrace|Terr|Trail|Circle|Cir|Square|Sq|Highway|Hwy|Parkway|Pkwy|Gardens|Gdns|Heights|Hts|Concession|Sideroad|Sdrd|Grove|Mews|Loop|Manor|Wynd|Landing|Gate|Close|Crossing|Path|Rue|Chemin';
  const fr = 'Rue|Chemin|Ch|Boulevard|Boul|Avenue|Av|Montée|Montee|Mtée|Mtee|Côte|Cote|Rang|Promenade|Allée|Allee|Place|Carré|Carre|Sentier|Impasse|Voie|Ruelle|Croissant';
  const dir = 'NE|NW|SE|SW|Northwest|Northeast|Southwest|Southeast|North|South|East|West|Nord|Sud|Est|Ouest|N|S|E|W|O';
  const word = "[\\p{L}0-9][\\p{L}0-9.'’-]*";
  // separators are same-line only ([ \t], never \n) so a match can't span lines
  // and swallow a preceding line (e.g. a "1-800 ..." phone line above the address).
  const unit = "(?:,?[ \\t]+(?:Apt|Apartment|Suite|Ste|Unit|Bureau|PH|RR|#)\\.?[ \\t]*\\d+[A-Za-z]?)?";
  return new RegExp(
    `\\b\\d{1,6}(?:[-–]\\d{1,5})?,?[ \\t]+` +
      `(?:(?:${fr})\\.?[ \\t]+(?:${word}[ \\t]*){1,4}|(?:${word}[ \\t]+){1,4}(?:${en})\\b\\.?)` +
      `(?:[ \\t]+(?:${dir})\\b)?${unit}`,
    'giu',
  );
})();

// Order matters: earlier recognizers win overlaps (credit card before phone,
// SIN before generic digit runs). Overlap resolution happens in detectPatterns.
const RECOGNIZERS: Recognizer[] = [
  // CRA Business Number + program account: 9 digits + RC/RT/RP/RZ + 4-digit ref.
  // Real CRA forms space the parts out ("12 3456 789 RP 0001", even fully
  // digit-spaced), so tolerate internal spaces throughout — the program-letter
  // anchor keeps false positives away.
  {
    category: 'BN',
    re: /\b(?:\d[ \t-]{0,2}){8}\d[ \t-]*R[A-Z][ \t-]*(?:\d[ \t-]{0,2}){3,4}\d\b/gi,
    score: 1,
  },
  // Trust account number: T + 8 digits
  { category: 'TRUST', re: /\bT\d{8}\b/g, score: 0.9 },
  // Credit / debit card: 13–19 digits (grouped), Luhn-valid
  {
    category: 'CREDIT_CARD',
    // Negative lookbehind skips digit runs introduced by an ID label (invoice / ref /
    // ledger / GL / PO / account ref) — those are 16-digit business IDs that pass Luhn
    // by coincidence (~10% of random 16-digit numbers) and must not be over-redacted.
    re: /(?<!\b(?:[Ii]nvoice|INV|[Ii]nv|[Rr]ef(?:erence)?|[Ll]edger|GL|CRM|PO|[Oo]rder|[Aa]ccount\s*ref)\s*(?:no\.?|number|#)?\s{0,3})\b(?:\d[ .\-]?){13,19}\b/g,
    valid: (m) => {
      const d = m.replace(/\D/g, '');
      // BIN guard: real cards start 3-6 (Amex/Visa/MC/Discover). Rejects Luhn-
      // coincident 16-digit GL/ledger/invoice IDs that would otherwise over-redact.
      return d.length >= 13 && d.length <= 19 && /^[3-6]/.test(d) && luhnValid(d);
    },
    score: 1,
  },
  // Credit card — label-anchored: a 13-19 digit group introduced by a card label
  // (or a network name) is redacted even if it FAILS Luhn. Same trust logic as the
  // labeled-SIN branch — a mistyped or sample card on a working paper is still a
  // card, and leaking it over one transposed digit is the failure that kills trust.
  {
    category: 'CREDIT_CARD',
    re: /(?<=\b(?:credit\s*card|card\s*(?:no\.?|number|#)?|visa|mastercard|amex|american\s*express)\b[^\d\n]{0,16})(?:\d[ .\-]?){13,19}(?!\d)/gi,
    score: 0.9,
  },
  // Provincial health number — label-anchored (its 7–12 digit shape collides with
  // SIN/phone, so we only claim it when introduced by a health label). Lookbehind
  // keeps the match = the number itself. Handles digit formats with spaces OR
  // dashes and OHIP's 1–2 trailing version letters, plus Quebec RAMQ's
  // alphanumeric form (4 letters + 8 digits, e.g. "FORO 9012 3456 78").
  {
    category: 'HEALTH',
    // The gap between label and value uses [^\d] (not [^\n\d]) so it crosses a line
    // break — on real forms the label sits on its own line above the value
    // ("OHIP Number:\n3195 550 125 NB"). Bounded to 40 non-digit chars so it can't
    // reach an unrelated number further down. Health numbers have no checksum, so
    // this label-proximity is the ONLY thing protecting them.
    re: /(?<=\b(?:health\s*(?:card|number|no\.?|#|insurance)?|PHN|PHIN|OHIP|MSP|RAMQ|AHCIP|AHC|medicare|(?:r[ée]gime\s*d['']?\s*)?assurance\s*maladie|carte\s*soleil)\b[^\d]{0,40})(?:[A-Z]{4}[\s-]?\d[\d \t.\-]{4,16}\d|\d[\d \t.\-]{4,20}\d)(?:[ -]?[A-Z]{1,2})?\b/gi,
    score: 0.95,
  },
  // Driver's licence — label-anchored (per-province formats vary too much to shape-match
  // safely). Tolerates a province qualifier between label and value ("Licence (ON): …")
  // and a line break (the gap class allows newlines).
  {
    category: 'DL',
    re: /(?<=\b(?:(?:driver'?s?\s*)?licen[cs]e|permis(?:\s*de\s*conduire)?|permit|DL)(?:\s*(?:no|number|#)\.?)?(?:\s*\([A-Za-z .]{2,10}\))?[\s:#-]{0,4})(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{4,19}\b/gi,
    score: 0.85,
  },
  // Canadian passport: 2 letters + 6 digits. Label-anchored form (with 'i') catches
  // lowercase and dashed variants; the bare uppercase shape stays case-sensitive and
  // is guarded against invoice/SKU/order references that share the exact shape.
  {
    category: 'PASSPORT',
    re: /(?<=\bpassport\s*(?:no\.?|number|#)?[^\d\n]{0,10})[A-Z]{2}[\s-]?\d{6,7}\b/gi,
    score: 0.85,
  },
  {
    category: 'PASSPORT',
    re: /(?<!\b(?:[Ii]nvoice|INV|[Ii]nv|SKU|[Rr]ef|[Oo]rder|PO|[Ii]tem|[Mm]odel|[Pp]art|[Cc]ode|[Pp]roduct)\.?\s{0,3})\b[A-Z]{2}\s?\d{6}\b/g,
    score: 0.8,
  },
  // Canadian SIN — label-anchored: a 9-digit group introduced by a SIN label is
  // redacted even if it FAILS Luhn. A mistyped or sample SIN is still a SIN, and
  // leaking a real one over a single transposed digit is the failure that kills
  // trust. (Unlabeled 9-digit runs still need the checksum, just below.)
  {
    category: 'SIN',
    re: /(?<=\b(?:SIN|NAS|social\s*insurance(?:\s*(?:number|no\.?|#))?|num[ée]ro\s*d['']assurance\s*sociale|assurance\s*sociale)[\s:#.\/-]{0,6})\d(?:[ \t.\/-]{0,2}\d){8}(?![0-9])/gi,
    score: 0.95,
  },
  // Canadian SIN — label-anchored with a WORDED / multi-line gap. Real forms write
  // "SIN on file:\n123 456 789" — the label sits above the value or has words between
  // them, so the tight branch above (whitespace-only gap) misses it. Here the label
  // must be a whole word (\b), the gap is bounded non-digit text (≤24 chars, crosses
  // line breaks), and the value must be the clean 3-3-3 SIN shape — that combination
  // keeps "Single …" / "casino …" from being mistaken for a SIN label. Bypasses Luhn:
  // a labeled SIN is redacted even if it fails the checksum (mistyped/sample).
  {
    category: 'SIN',
    re: /(?<=\b(?:SIN|NAS|social\s*insurance(?:\s*(?:number|no\.?|#))?|num[ée]ro\s*d['']assurance\s*sociale|assurance\s*sociale)\b[^\d]{0,24})\d{3}[ .\/-]?\d{3}[ .\/-]?\d{3}(?![0-9])/gi,
    score: 0.9,
  },
  // Canadian SIN — unlabeled: 9 digits in 3-3-3 grouping, Luhn-valid (the checksum
  // is what keeps random 9-digit IDs from being claimed when there's no label).
  // Separator allows space/dash/dot since the Luhn check gates false positives.
  {
    category: 'SIN',
    re: /\b\d{3}[ .\-]?\d{3}[ .\-]?\d{3}\b/g,
    valid: (m) => luhnValid(m),
    score: 1,
  },
  // Bank account — dashed/slashed transit-institution-account form. Transit is
  // EXACTLY 5 digits and institution EXACTLY 3 (the real Canadian shape); this
  // excludes 4-3-7 invoice/PO numbers that the looser 4-5/2-3 form over-redacted,
  // while the 4-12 account group catches the full 5-3-12 void-cheque format.
  { category: 'BANK_ACCOUNT', re: /\b\d{5}[-\/]\d{3}[-\/]\d{4,12}\b/g, score: 0.85 },
  // Bank account — label-anchored Canadian coordinates (transit 5 / institution 3
  // / account 7–12), as they appear on void cheques and EFT/direct-deposit setup.
  // Each piece is claimed where its own label introduces it.
  { category: 'BANK_ACCOUNT', re: /(?<=\b(?:transit|branch)\s*(?:no\.?|number|#)?[\s:#.-]{0,4})\d{5}\b/gi, score: 0.8 },
  { category: 'BANK_ACCOUNT', re: /(?<=\b(?:institution|inst)\s*(?:no\.?|number|#)?[\s:#.-]{0,4})\d{3}\b/gi, score: 0.7 },
  { category: 'BANK_ACCOUNT', re: /(?<=\b(?:account|acct|a\/c|compte)\s*(?:no\.?|number|num|#)?[\s:#.-]{0,4})\d[\d \-]{3,14}\d\b/gi, score: 0.8 },
  // Street address (civic number + street name + type) — see ADDRESS_RE above
  { category: 'ADDRESS', re: ADDRESS_RE, score: 0.8 },
  // Rural route designator (RR 3, R.R. 5, Rural Route 2) — common rural Canadian
  // mailing address with no civic-number+street-type shape of its own.
  { category: 'ADDRESS', re: /\b(?:R\.?R\.?|Rural\s+Route)\s*#?\s*\d{1,3}\b/gi, score: 0.75 },
  // Canadian postal code: A1A 1A1 (tolerate up to 2 space/dash/slash separators for
  // PDF double-spacing and form-template slashes)
  { category: 'POSTAL', re: /\b[A-Za-z]\d[A-Za-z][ \t\/-]{0,2}\d[A-Za-z]\d\b/g, score: 0.95 },
  // Email. Tolerates spaces around '@' (a routine OCR/typo artifact) and accented
  // IDN domains (québec-fiscal.ca) via \p{L} + the u flag — same letter class the
  // address layer already uses. Still anchored by the literal dot + TLD.
  { category: 'EMAIL', re: /[A-Za-z0-9._%+-]+\s?@\s?[\p{L}0-9.-]+\.[\p{L}]{2,}/gu, score: 1 },
  // Phone (NANP): optional +1, area, exchange, line. Separators are optional (catches
  // unseparated export form 6045550199) but the area code and exchange must start
  // [2-9] per NANP — this is what keeps random 10-digit IDs from being claimed as
  // phones. Trailing (?!\d) lets a glued suffix ("...0132ext204") still match.
  {
    category: 'PHONE',
    re: /(?<![\d.])(?:\+?1[ .\-]?)?\(?[2-9]\d{2}\)?[ .,\/-]?[2-9]\d{2}[ .,\/-]?\d{4}(?!\d)/g,
    score: 0.9,
  },
  // Form-field ORG capture — the neural layer misses some company names, so when an
  // explicit org-field label introduces a value we claim it deterministically. Runs
  // before the PERSON field (so "Corp name:" is an ORG, not a person). Value excludes
  // digits/commas so it stops before a trailing " BN 12 3456…" or the next field.
  {
    category: 'ORG',
    re: /(?<=\b(?:corp(?:oration)?(?:\s+name)?|company(?:\s+name)?|employer|business\s+name)\s*:[ \t]*)[A-Za-z][\p{L}\p{M}&'’.\- ]*[\p{L}.]/giu,
    score: 0.7,
  },
  // Form-field PERSON capture — covers names the neural NER misses (hyphenated
  // French names, some surnames) when they sit in an explicit same-line name field.
  // Value stays on the label's line (no newline crossing — that mis-fired on
  // column-jumbled PDFs, grabbing the next field). Handles "LAST, First" order.
  {
    category: 'PERSON',
    re: /(?<=\b(?:employee\s+name|account\s+holder|client(?:\s+name)?|contact|spouse|taxpayer|name|prepared\s+by)\s*:[ \t]*)[A-Za-zÀ-ÖØ-Þ][\p{L}\p{M}'’.\- ]*(?:,[ \t]*[A-Za-zÀ-ÖØ-Þ][\p{L}\p{M}'’.\- ]*)?[\p{L}.]/giu,
    score: 0.7,
  },
];

/** Detect all deterministic-pattern spans, resolving overlaps by recognizer order. */
export function detectPatterns(text: string): Span[] {
  const claimed: boolean[] = new Array(text.length).fill(false);
  const spans: Span[] = [];
  for (const r of RECOGNIZERS) {
    r.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.re.exec(text)) !== null) {
      const value = m[0];
      const start = m.index;
      const end = start + value.length;
      if (r.valid && !r.valid(value)) continue;
      // skip if any char already claimed by an earlier (higher-priority) recognizer
      let overlap = false;
      for (let i = start; i < end; i++) if (claimed[i]) { overlap = true; break; }
      if (overlap) continue;
      for (let i = start; i < end; i++) claimed[i] = true;
      spans.push({ start, end, category: r.category, text: value, source: 'pattern', score: r.score });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

// Short, human-readable token labels per category (what the AI sees).
export const TOKEN_LABEL: Record<Category, string> = {
  SIN: 'SIN', BN: 'BIZ', TRUST: 'TRUST', CREDIT_CARD: 'CARD', BANK_ACCOUNT: 'ACCT',
  ADDRESS: 'ADDR', POSTAL: 'POSTAL', EMAIL: 'EMAIL', PHONE: 'PHONE', HEALTH: 'HEALTH',
  PASSPORT: 'PASSPORT', DL: 'LICENCE', PERSON: 'PERSON', ORG: 'ORG',
};

/** Normalize a value so the same entity maps to one token despite formatting. */
function normalize(category: Category, text: string): string {
  if (category === 'EMAIL' || category === 'PERSON' || category === 'ORG') return text.toLowerCase().replace(/\s+/g, ' ').trim();
  return text.replace(/[\s-]/g, '').toUpperCase(); // numbers/IDs: ignore spaces & dashes
}

export interface Tokenized {
  /** span (by key) -> stable token like "PERSON_1" */
  tokenForSpan: Map<Span, string>;
  /** token -> the original value it replaced (the re-identify map; stays local) */
  registry: Map<string, string>;
}

/**
 * Consistent pseudonymization: assign each DISTINCT entity a stable numbered
 * token, reused everywhere it appears. Preserves who-is-who for the AI while
 * removing identity. Numbering is per-category, in document order.
 */
export function assignTokens(spans: Span[]): Tokenized {
  const order = [...spans].sort((a, b) => a.start - b.start);
  const perCat = new Map<Category, Map<string, number>>();
  const tokenForSpan = new Map<Span, string>();
  const registry = new Map<string, string>();
  for (const s of order) {
    const norm = normalize(s.category, s.text);
    let seen = perCat.get(s.category);
    if (!seen) { seen = new Map(); perCat.set(s.category, seen); }
    let idx = seen.get(norm);
    if (idx === undefined) { idx = seen.size + 1; seen.set(norm, idx); }
    const token = `${TOKEN_LABEL[s.category]}_${idx}`;
    tokenForSpan.set(s, token);
    if (!registry.has(token)) registry.set(token, s.text);
  }
  return { tokenForSpan, registry };
}

/**
 * Reverse the pseudonymization: swap every token in the AI's response back to
 * the original value, using the registry built during redaction. This closes
 * the loop — the CPA pastes the AI's tokenized answer and gets the real names
 * back, all locally. Tokens are replaced longest-first so PERSON_12 is restored
 * before PERSON_1 (no prefix clobbering), and surrounding [brackets] are
 * optional since the model may echo the token with or without them.
 */
export function reidentify(text: string, registry: Map<string, string>): string {
  const entries = [...registry.entries()].sort((a, b) => b[0].length - a[0].length);
  let out = text;
  for (const [token, original] of entries) {
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\[?${esc}\\]?`, 'g'), original);
  }
  return out;
}

/** Produce AI-safe text: each entity replaced by its stable [TOKEN_n]. */
export function applyRedaction(text: string, spans: Span[], tokens?: Tokenized): string {
  const t = tokens ?? assignTokens(spans);
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const s of sorted) {
    if (s.start < cursor) continue; // skip overlaps defensively
    out += text.slice(cursor, s.start) + `[${t.tokenForSpan.get(s) ?? s.category}]`;
    cursor = s.end;
  }
  return out + text.slice(cursor);
}
