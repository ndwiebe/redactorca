// Smoke coverage for the .docx input path. The browser uses
// mammoth.extractRawText({ arrayBuffer }) — here we exercise the same library
// on the same fixture node-side, so a mammoth upgrade that breaks extraction
// fails CI instead of failing a CPA.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mammoth from 'mammoth';

describe('.docx extraction (mammoth)', () => {
  it('extracts the text of a real sample engagement letter', async () => {
    const buffer = readFileSync(join(__dirname, '..', 'test', 'fixtures', 'sample.docx'));
    const res = await mammoth.extractRawText({ buffer });
    expect(res.value.length).toBeGreaterThan(1000);
    expect(res.value).toMatch(/engagement/i);
  });

  it('throws on a non-docx buffer (the UI catches this and tells the user)', async () => {
    await expect(mammoth.extractRawText({ buffer: Buffer.from('not a zip archive') })).rejects.toThrow();
  });
});
