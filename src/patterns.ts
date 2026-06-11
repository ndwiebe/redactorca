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
  | 'PERSON'; // filled by the neural layer, not here

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
  const en = 'Street|St|Avenue|Ave|Av|Road|Rd|Boulevard|Blvd|Boul|Drive|Dr|Crescent|Cres|Court|Crt|Ct|Place|Pl|Lane|Ln|Terrace|Terr|Trail|Circle|Cir|Square|Sq|Highway|Hwy|Parkway|Pkwy|Gardens|Gdns|Heights|Hts|Concession|Sideroad|Sdrd';
  const fr = 'Rue|Chemin|Ch|Boulevard|Boul|Avenue|Av|Montée|Mtée|Côte|Rang|Promenade|Allée|Place|Carré';
  const dir = 'NE|NW|SE|SW|North|South|East|West|Nord|Sud|Est|Ouest|N|S|E|W|O';
  const word = "[\\p{L}0-9][\\p{L}0-9.'’-]*";
  // separators are same-line only ([ \t], never \n) so a match can't span lines
  // and swallow a preceding line (e.g. a "1-800 ..." phone line above the address).
  const unit = "(?:,?[ \\t]+(?:Apt|Apartment|Suite|Ste|Unit|Bureau|PH|RR|#)\\.?[ \\t]*\\d+[A-Za-z]?)?";
  return new RegExp(
    `\\b\\d{1,6}(?:[-–]\\d{1,5})?[ \\t]+` +
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
    re: /\b(?:\d[ ]?){8}\d\s*R[CTPZ]\s*(?:\d[ ]?){3}\d\b/gi,
    score: 1,
  },
  // Trust account number: T + 8 digits
  { category: 'TRUST', re: /\bT\d{8}\b/g, score: 0.9 },
  // Credit / debit card: 13–19 digits (grouped), Luhn-valid
  {
    category: 'CREDIT_CARD',
    re: /\b(?:\d[ -]?){13,19}\b/g,
    valid: (m) => {
      const d = m.replace(/\D/g, '');
      return d.length >= 13 && d.length <= 19 && luhnValid(d);
    },
    score: 1,
  },
  // Provincial health number — label-anchored (its 7–12 digit shape collides with
  // SIN/phone, so we only claim it when introduced by a health label). Lookbehind
  // keeps the match = the number itself. Handles digit formats with spaces OR
  // dashes and OHIP's 1–2 trailing version letters, plus Quebec RAMQ's
  // alphanumeric form (4 letters + 8 digits, e.g. "FORO 9012 3456 78").
  {
    category: 'HEALTH',
    re: /(?<=\b(?:health\s*(?:card|number|no\.?|#)?|PHN|OHIP|MSP|RAMQ|AHC)\b[^\n\d]{0,28})(?:[A-Z]{4}[\s-]?\d[\d \-]{4,10}\d|\d[\d \-]{5,11}\d)(?:[ -]?[A-Z]{1,2})?\b/gi,
    score: 0.95,
  },
  // Driver's licence — label-anchored (per-province formats vary too much to shape-match safely)
  {
    category: 'DL',
    re: /(?<=\b(?:driver'?s?\s*licen[cs]e|licen[cs]e\s*(?:no\.?|#|number)?|DL)\b[\s:#-]{0,4})[A-Z0-9][A-Z0-9 -]{4,14}\b/gi,
    score: 0.85,
  },
  // Canadian passport: 2 letters + 6 digits (distinctive shape)
  { category: 'PASSPORT', re: /\b[A-Z]{2}\s?\d{6}\b/g, score: 0.8 },
  // Canadian SIN — label-anchored: a 9-digit group introduced by a SIN label is
  // redacted even if it FAILS Luhn. A mistyped or sample SIN is still a SIN, and
  // leaking a real one over a single transposed digit is the failure that kills
  // trust. (Unlabeled 9-digit runs still need the checksum, just below.)
  {
    category: 'SIN',
    re: /(?<=\b(?:SIN|NAS|social\s*insurance(?:\s*(?:number|no\.?|#))?|num[ée]ro\s*d['']assurance\s*sociale|assurance\s*sociale)\b[\s:#.\/-]{0,6})\d{3}[ -]?\d{3}[ -]?\d{3}\b/gi,
    score: 0.95,
  },
  // Canadian SIN — unlabeled: 9 digits in 3-3-3 grouping, Luhn-valid (the checksum
  // is what keeps random 9-digit IDs from being claimed when there's no label).
  {
    category: 'SIN',
    re: /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g,
    valid: (m) => luhnValid(m),
    score: 1,
  },
  // Bank account — dashed transit-institution-account form
  { category: 'BANK_ACCOUNT', re: /\b\d{4,5}-\d{2,3}-\d{5,7}\b/g, score: 0.85 },
  // Bank account — label-anchored Canadian coordinates (transit 5 / institution 3
  // / account 7–12), as they appear on void cheques and EFT/direct-deposit setup.
  // Each piece is claimed where its own label introduces it.
  { category: 'BANK_ACCOUNT', re: /(?<=\b(?:transit|branch)\s*(?:no\.?|number|#)?[\s:#.-]{0,4})\d{5}\b/gi, score: 0.8 },
  { category: 'BANK_ACCOUNT', re: /(?<=\b(?:institution|inst)\s*(?:no\.?|number|#)?[\s:#.-]{0,4})\d{3}\b/gi, score: 0.7 },
  { category: 'BANK_ACCOUNT', re: /(?<=\b(?:account|acct|a\/c|compte)\s*(?:no\.?|number|num|#)?[\s:#.-]{0,4})\d[\d \-]{3,14}\d\b/gi, score: 0.8 },
  // Street address (civic number + street name + type) — see ADDRESS_RE above
  { category: 'ADDRESS', re: ADDRESS_RE, score: 0.8 },
  // Canadian postal code: A1A 1A1
  { category: 'POSTAL', re: /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/g, score: 0.95 },
  // Email
  { category: 'EMAIL', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, score: 1 },
  // Phone (NANP): optional +1, area, exchange, line
  {
    category: 'PHONE',
    re: /(?:\+?1[ .\-]?)?\(?\d{3}\)?[ .\-]\d{3}[ .\-]\d{4}\b/g,
    score: 0.9,
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
  PASSPORT: 'PASSPORT', DL: 'LICENCE', PERSON: 'PERSON',
};

/** Normalize a value so the same entity maps to one token despite formatting. */
function normalize(category: Category, text: string): string {
  if (category === 'EMAIL' || category === 'PERSON') return text.toLowerCase().replace(/\s+/g, ' ').trim();
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
