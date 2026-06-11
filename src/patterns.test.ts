import { describe, it, expect } from 'vitest';
import { detectPatterns, applyRedaction, assignTokens, reidentify, luhnValid } from './patterns';

// Luhn-valid synthetic SINs (generated; pass the checksum like real SINs).
const SIN_A = '700 042 344';
const SIN_B = '700 090 277';
const VISA = '4539148803436467'; // Luhn-valid test card

const cats = (text: string) => detectPatterns(text).map((s) => s.category);

describe('luhnValid', () => {
  it('accepts valid, rejects invalid', () => {
    expect(luhnValid('700042344')).toBe(true);
    expect(luhnValid('453821996')).toBe(false); // not Luhn-valid
  });
});

describe('detectPatterns — structured IDs, layout-independent', () => {
  it('catches a SIN in prose', () => {
    expect(cats(`Client SIN is ${SIN_A} on file.`)).toContain('SIN');
  });

  it('catches SINs INSIDE a table (the case the neural model leaked)', () => {
    const table =
      `Name        SIN            Net\n` +
      `Gretzky     ${SIN_A}    8,526.00\n` +
      `Wembanyama  ${SIN_B}    1,935.00`;
    const found = detectPatterns(table);
    const sins = found.filter((s) => s.category === 'SIN');
    expect(sins.length).toBe(2); // both SINs caught despite columnar layout
  });

  it('does NOT redact dollar amounts (keep the financials)', () => {
    const text = `Proceeds 9,800.00 Fees 1,274.00 Net 8,526.00 gain 6,210.00`;
    expect(detectPatterns(text).length).toBe(0);
  });

  it('catches CRA business/program account', () => {
    expect(cats('GST/HST account 80452 1188 RT0001 confirmed.')).toContain('BN');
  });

  it('catches a Luhn-valid credit card and not as a phone', () => {
    const found = detectPatterns(`Visa ${VISA} exp 09/27`);
    expect(found.some((s) => s.category === 'CREDIT_CARD')).toBe(true);
    // the 10-digit phone regex must not also claim digits inside the card
    expect(found.filter((s) => s.category === 'PHONE').length).toBe(0);
  });

  it('catches email, phone, postal, trust number', () => {
    const c = cats('a@b.ca / (780) 555-0142 / T6E 2B4 / trust T12345678');
    expect(c).toContain('EMAIL');
    expect(c).toContain('PHONE');
    expect(c).toContain('POSTAL');
    expect(c).toContain('TRUST');
  });

  it('rejects a non-Luhn 9-digit string as a SIN (precision)', () => {
    expect(cats('ref number 123456789 in the file')).not.toContain('SIN');
  });

  it('catches a labelled provincial health number, not as SIN', () => {
    const c = cats('OHIP: 1234 567 890 AB');
    expect(c).toContain('HEALTH');
    const c2 = cats('PHN 123456789');
    expect(c2).toContain('HEALTH');
  });

  it('catches a labelled driver licence', () => {
    expect(cats("Driver's licence: T0360-12345-67890")).toContain('DL');
  });

  it('catches a Canadian passport shape', () => {
    expect(cats('Passport GA123456 issued 2021')).toContain('PASSPORT');
  });

  it('does not flag a bare unlabelled 9-digit health-shaped number as HEALTH', () => {
    // no health label -> should not be HEALTH (avoids over-claiming)
    expect(cats('widget count 987654321 units')).not.toContain('HEALTH');
  });

  // --- regressions from the real-document stress test (2026-06-11) ---

  it('redacts a LABELLED SIN even when it fails Luhn (mistyped/sample SINs still leak)', () => {
    // 130 692 545 is NOT Luhn-valid, but it is explicitly labelled a SIN.
    expect(cats('N.A.S./SIN 130 692 545')).toContain('SIN');
    expect(cats('Social insurance number 805 123 456')).toContain('SIN');
    expect(cats('SIN: 130-692-546')).toContain('SIN'); // dashes
    expect(cats('SIN 130692547')).toContain('SIN'); // no separators
  });

  it('still requires Luhn for an UNLABELLED 9-digit number (precision)', () => {
    expect(cats('reference 130 692 545 attached')).not.toContain('SIN');
  });

  it('catches a Business Number with CRA spacing ("12 3456 789 RP 0001")', () => {
    expect(cats('Business Number 12 3456 789 RP 0001')).toContain('BN');
    expect(cats('8 6 7 5 3 0 9 0 9 RC 0001')).toContain('BN'); // fully digit-spaced
  });

  it('catches inline bank coordinates (transit / institution / account)', () => {
    const c = cats('Direct deposit: transit 12345 institution 004 account 7654321');
    expect(c.filter((x) => x === 'BANK_ACCOUNT').length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT flag a dollar figure as a bank account when no account label precedes it', () => {
    // "7654321" here is an amount, not labelled "account"
    expect(cats('Office and administration expense 7654321')).not.toContain('BANK_ACCOUNT');
  });

  it('catches RAMQ (alpha) and dashed OHIP health numbers behind qualified labels', () => {
    expect(cats('Health card (Quebec RAMQ) on file: FORO 9012 3456 78')).toContain('HEALTH');
    expect(cats('Ontario health card (prior address): 1234-567-890-AB')).toContain('HEALTH');
  });

  it('catches street addresses (English and French order, ALL CAPS, units)', () => {
    expect(cats('88 Wellesley St E')).toContain('ADDRESS');
    expect(cats('1234 ANY STREET, SUITE 5678')).toContain('ADDRESS');
    expect(cats('4521 Rue Sainte-Catherine, Apt 7')).toContain('ADDRESS');
    expect(cats('100 boulevard René-Lévesque Ouest')).toContain('ADDRESS');
  });

  it('does NOT flag tax line refs, share counts, or amounts as an address (precision)', () => {
    expect(cats('Line 150 net income 50000')).not.toContain('ADDRESS');
    expect(cats('issued 50000 Common shares')).not.toContain('ADDRESS');
    expect(cats('Box 14 Employment income 52,000.00')).not.toContain('ADDRESS');
    expect(cats('we worked 1500 hours this year')).not.toContain('ADDRESS');
  });
});

describe('applyRedaction (consistent pseudonymization)', () => {
  it('replaces each entity with a stable numbered token, keeps amounts', () => {
    const text = `${SIN_A} earned 9,800.00`;
    const out = applyRedaction(text, detectPatterns(text));
    expect(out).toContain('[SIN_1]');
    expect(out).toContain('9,800.00');
    expect(out).not.toContain(SIN_A);
  });

  it('same value -> same token; different values -> different tokens', () => {
    const text = `${SIN_A} and ${SIN_B} and again ${SIN_A}`;
    const spans = detectPatterns(text);
    const out = applyRedaction(text, spans);
    // SIN_A appears twice -> both SIN_1; SIN_B -> SIN_2
    expect(out).toBe('[SIN_1] and [SIN_2] and again [SIN_1]');
  });

  it('assignTokens builds a re-identify registry', () => {
    const text = `${SIN_A}, ${SIN_B}`;
    const t = assignTokens(detectPatterns(text));
    expect(t.registry.get('SIN_1')).toBe(SIN_A);
    expect(t.registry.get('SIN_2')).toBe(SIN_B);
  });
});

describe('reidentify (turn the AI answer back into real values)', () => {
  it('restores tokens, with or without brackets', () => {
    const reg = new Map([['PERSON_1', 'Daniel Tremblay'], ['SIN_1', '700 042 344']]);
    expect(reidentify('Tell [PERSON_1] their SIN [SIN_1] is on file', reg))
      .toBe('Tell Daniel Tremblay their SIN 700 042 344 is on file');
    expect(reidentify('PERSON_1 owes nothing', reg)).toBe('Daniel Tremblay owes nothing');
  });

  it('restores longer token numbers without clobbering (PERSON_1 vs PERSON_12)', () => {
    const reg = new Map([['PERSON_1', 'Anita'], ['PERSON_12', 'Bob']]);
    expect(reidentify('[PERSON_12] met [PERSON_1]', reg)).toBe('Bob met Anita');
  });

  it('round-trips: redact then re-identify returns the originals', () => {
    const text = `${SIN_A} paid 9,800.00 to a vendor`;
    const spans = detectPatterns(text);
    const t = assignTokens(spans);
    const redacted = applyRedaction(text, spans, t);
    expect(reidentify(redacted, t.registry)).toBe(text);
  });
});
