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
  | 'POSTAL'
  | 'EMAIL'
  | 'PHONE'
  | 'HEALTH' // provincial health number (best-effort, often labelled)
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

// Order matters: earlier recognizers win overlaps (credit card before phone,
// SIN before generic digit runs). Overlap resolution happens in detectPatterns.
const RECOGNIZERS: Recognizer[] = [
  // CRA Business Number + program account: 9 digits + RC/RT/RP/RZ + 4-digit ref
  {
    category: 'BN',
    re: /\b\d{5}\s?\d{4}\s?R[CTPZ]\s?\d{4}\b/gi,
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
  // Canadian SIN: 9 digits in 3-3-3 grouping, Luhn-valid
  {
    category: 'SIN',
    re: /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g,
    valid: (m) => luhnValid(m),
    score: 1,
  },
  // Bank account in dashed transit-institution-account form
  { category: 'BANK_ACCOUNT', re: /\b\d{4,5}-\d{2,3}-\d{5,7}\b/g, score: 0.85 },
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

/** Apply spans to text, replacing each with a mask (█ run) or a labelled token. */
export function applyRedaction(
  text: string,
  spans: Span[],
  opts: { mode: 'block' | 'label' } = { mode: 'label' },
): string {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const s of sorted) {
    if (s.start < cursor) continue; // skip overlaps defensively
    out += text.slice(cursor, s.start);
    out += opts.mode === 'block' ? '█'.repeat(s.end - s.start) : `[${s.category}]`;
    cursor = s.end;
  }
  out += text.slice(cursor);
  return out;
}
