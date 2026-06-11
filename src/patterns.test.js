import { describe, it, expect } from 'vitest';
import { detectPatterns, applyRedaction, luhnValid } from './patterns';
// Luhn-valid synthetic SINs (generated; pass the checksum like real SINs).
const SIN_A = '700 042 344';
const SIN_B = '700 090 277';
const VISA = '4539148803436467'; // Luhn-valid test card
const cats = (text) => detectPatterns(text).map((s) => s.category);
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
        const table = `Name        SIN            Net\n` +
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
});
describe('applyRedaction', () => {
    it('label mode replaces spans with category tokens, keeps amounts', () => {
        const text = `${SIN_A} earned 9,800.00`;
        const out = applyRedaction(text, detectPatterns(text), { mode: 'label' });
        expect(out).toContain('[SIN]');
        expect(out).toContain('9,800.00');
        expect(out).not.toContain(SIN_A);
    });
    it('block mode masks with full-width blocks', () => {
        const text = `SIN ${SIN_A}`;
        const out = applyRedaction(text, detectPatterns(text), { mode: 'block' });
        expect(out).toContain('█');
        expect(out).not.toContain(SIN_A);
    });
});
