// Regression suite over the real-document corpus (test/fixtures/corpus-*.md):
// 24 realistic Canadian document samples (CRA slips, pay stubs, bank statements,
// invoices, cheques) with ground-truth answer keys, built 2026-06-11 from public
// specimen forms. All data is synthetic/sample — safe to publish.
//
// Two guarantees this locks in:
//   1. PRECISION: dollar amounts are NEVER redacted (the keep-the-financials promise).
//   2. RECALL: structured-PII detection stays at or above the level shipped today.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectPatterns, type Category, type Span } from './patterns';

const FILES = ['corpus-tax.md', 'corpus-biz.md'].map((f) => join(__dirname, '..', 'test', 'fixtures', f));

const KEY_TO_CAT: Record<string, Category> = {
  sins: 'SIN',
  business_numbers: 'BN',
  bank_accounts: 'BANK_ACCOUNT',
  credit_cards: 'CREDIT_CARD',
  postal_codes: 'POSTAL',
  phones: 'PHONE',
  emails: 'EMAIL',
  health_numbers: 'HEALTH',
  trust_numbers: 'TRUST',
  passports: 'PASSPORT',
  drivers_licences: 'DL',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9@]/g, '');
const normAmount = (s: string) => s.replace(/[^0-9.]/g, '');

interface Sample { name: string; text: string; gt: Record<string, string[]> }

function parseCorpus(file: string): Sample[] {
  const raw = readFileSync(file, 'utf8');
  const parts = raw.split(/^### SAMPLE:\s*/m).slice(1);
  const out: Sample[] = [];
  for (const part of parts) {
    const name = part.split('\n')[0].trim();
    const fence = part.match(/```[a-z]*\n([\s\S]*?)```/);
    const text = fence ? fence[1] : part.slice(0, part.indexOf('<!--'));
    const gtBlock = part.match(/GROUND_TRUTH([\s\S]*?)-->/);
    const gt: Record<string, string[]> = {};
    if (gtBlock) {
      for (const line of gtBlock[1].split('\n')) {
        const m = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.+)$/);
        if (!m) continue;
        const valRaw = m[2].trim();
        if (/^\(?none\)?/i.test(valRaw)) { gt[m[1]] = []; continue; }
        gt[m[1]] = valRaw
          .split(/[,;](?![0-9]{3})/)
          // strip the corpus authors' parenthetical annotations ("(row 3, in table cell)")
          .map((v) => v.replace(/\(.*?\)/g, '').replace(/\(.*$/, '').trim())
          // keep only things that look like actual data values, not prose notes
          .filter((v) => /\d{4,}|@/.test(v.replace(/[ \-]/g, '')));
      }
    }
    out.push({ name, text, gt });
  }
  return out;
}

interface Tally { expected: number; masked: number; overRedactions: string[]; leaks: string[] }

function score(): Tally {
  const tally: Tally = { expected: 0, masked: 0, overRedactions: [], leaks: [] };
  for (const file of FILES) {
    for (const s of parseCorpus(file)) {
      const spans = detectPatterns(s.text);
      const allNorm = spans.map((sp: Span) => norm(sp.text));
      for (const [key, vals] of Object.entries(s.gt)) {
        if (!KEY_TO_CAT[key]) continue;
        for (const v of vals) {
          const nv = norm(v);
          if (nv.length < 4) continue;
          tally.expected++;
          const hit = allNorm.some((n) => n.includes(nv) || (nv.includes(n) && n.length >= 5));
          if (hit) tally.masked++;
          else tally.leaks.push(`[${s.name}] ${key}: "${v}"`);
        }
      }
      for (const amt of s.gt['amounts_to_KEEP'] || []) {
        const na = normAmount(amt);
        if (na.length < 3) continue;
        const hit = spans.find((sp) => normAmount(sp.text) === na);
        if (hit) tally.overRedactions.push(`[${s.name}] "${amt}" flagged as ${hit.category}`);
      }
    }
  }
  return tally;
}

describe('real-document corpus regression', () => {
  const t = score();

  it('parses a meaningful corpus (sanity)', () => {
    expect(t.expected).toBeGreaterThan(50);
  });

  it('NEVER redacts a dollar amount (precision guarantee)', () => {
    expect(t.overRedactions).toEqual([]);
  });

  it('keeps structured-PII recall at or above the shipped level (>= 80%)', () => {
    const recall = t.masked / t.expected;
    if (recall < 0.8) {
      // surface the leaks in the failure output so the regression is debuggable
      expect(t.leaks).toEqual([]);
    }
    expect(recall).toBeGreaterThanOrEqual(0.8);
  });
});
