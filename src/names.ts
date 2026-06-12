// Neural name detection — the one PII class regex can't do (names have no format).
// Runs a multilingual BERT NER model (token-classification) in-browser via
// transformers.js on the WASM backend. Multilingual matters here: Canadian files
// are full of French names (Amélie Côté, Tremblay) an English-only model fumbles.
// The user's document never leaves the machine; only the model weights are
// fetched (once, then cached in the browser). We use this generic NER purely for
// its PERSON spans — every structured PII class is handled by the regex layer,
// which the official PII model's q4/q8 exports can't beat in WASM (their
// block-quantized embeddings need WebGPU, which stock Chrome lacks).
//
// Strategy for the table-leak fix: the model is a prose sequence model and goes
// blind on column-aligned text, so we run detection on a WHITESPACE-COLLAPSED
// copy, recover the detected PERSON surface strings, then locate those strings
// back in the ORIGINAL text to produce character spans. This catches names that
// sit inside table cells, which raw detection misses.
import type { Span, Category } from './patterns';

let pipePromise: Promise<unknown> | null = null;

export interface NamesProgress { (pct: number, label: string): void; }

export function isNamesLoaded(): boolean {
  return pipePromise !== null;
}

async function getPipe(onProgress?: NamesProgress) {
  if (pipePromise) return pipePromise;
  pipePromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    // Allow the one-time model fetch (weights only). For the Phase-3 no-egress
    // build this flips to bundled/self-hosted so even this fetch disappears.
    env.allowRemoteModels = true;
    // q8 (model_quantized.onnx) on the plain WASM backend — this export uses
    // standard int8 ops every browser can run, no WebGPU required.
    return pipeline('token-classification', 'Xenova/bert-base-multilingual-cased-ner-hrl', {
      dtype: 'q8',
      progress_callback: (p: { status?: string; progress?: number; file?: string }) => {
        if (onProgress && typeof p.progress === 'number') {
          onProgress(Math.round(p.progress), p.file || p.status || 'loading');
        }
      },
    });
  })().catch((e) => { pipePromise = null; throw e; });
  return pipePromise;
}

/** Collapse runs of 2+ spaces/tabs so column gaps don't break the sequence model. */
function reflow(text: string): string {
  return text.replace(/[ \t]{2,}/g, ' , ');
}

/**
 * Title-case ALL-CAPS words. The NER model is cased and trained on normal prose,
 * so it goes blind on SHOUTED names — and Canadian tax slips MANDATE surnames in
 * capitals ("Last name in capital letters"), bank statements use them too. This
 * is a case-only transform, so character offsets are preserved 1:1 and detected
 * spans still map back to the original text. We match back case-insensitively.
 */
function decase(text: string): string {
  return text.replace(/\p{Lu}[\p{Lu}'’-]+/gu, (w) => w[0] + w.slice(1).toLowerCase());
}

interface RawTok { entity?: string; entity_group?: string; word?: string; index?: number }

/**
 * Reassemble consecutive PERSON sub-word tokens into surface strings.
 *
 * The token-classification pipeline returns ONLY entity tokens — it silently
 * drops every 'O' (outside) token. So we can't rely on a non-PER token to mark
 * a name boundary; without that, three separate people collapse into one run.
 * Instead split on the BIO 'B-' (begin) prefix and on any gap in the token
 * `index` (non-contiguous indices = a non-entity word sat between them).
 */
interface EntityString { text: string; category: Category; }

function entityStrings(out: RawTok[]): EntityString[] {
  const results: EntityString[] = [];
  let cur = '';
  let curCat: Category = 'PERSON';
  let prevIdx = -100;
  const flush = () => {
    const s = cur.replace(/\s+/g, ' ').trim();
    if (s.length > 1) results.push({ text: s, category: curCat });
    cur = '';
  };
  for (const t of out) {
    const label = (t.entity || t.entity_group || '').toUpperCase();
    const w = t.word || '';
    const idx = typeof t.index === 'number' ? t.index : prevIdx + 1;
    const isPer = label.includes('PER');
    const isOrg = label.includes('ORG');
    if (isPer || isOrg) {
      const cat: Category = isPer ? 'PERSON' : 'ORG';
      if (cur && (label.startsWith('B-') || idx !== prevIdx + 1 || cat !== curCat)) flush();
      curCat = cat;
      if (w.startsWith('##')) cur += w.slice(2);
      else cur += (cur ? ' ' : '') + w.replace(/^[ Ġ]/, '');
    } else {
      flush();
    }
    prevIdx = idx;
  }
  flush();
  // dedupe by text+category
  const seen = new Set<string>();
  return results.filter(e => { const k = `${e.category}:${e.text}`; return seen.has(k) ? false : (seen.add(k), true); });
}

/**
 * Build a whitespace-flexible regex to find a detected name in the original text.
 * Boundaries use Unicode letter/number lookarounds, NOT `\b` — `\b` is ASCII-only,
 * so it fails right after an accented char ("Côté'" has no ASCII word boundary
 * after é) and would miss every French-Canadian name. The `u` flag + \p{L}\p{M}
 * also keeps accented letters and combining marks intact.
 */
function nameToRegex(name: string): RegExp {
  const parts = name.split(/\s+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
  // case-insensitive: the model sees a title-cased copy, the original may SHOUT.
  return new RegExp(`(?<![\\p{L}\\p{N}])${parts.join('\\s+')}(?![\\p{L}\\p{N}])`, 'gui');
}

/** Detect PERSON and ORG spans in `text`. Returns char-offset spans against the ORIGINAL text. */
export async function detectNames(text: string, onProgress?: NamesProgress): Promise<Span[]> {
  const pipe = (await getPipe(onProgress)) as (t: string) => Promise<RawTok[]>;
  const out = await pipe(decase(reflow(text)));
  const entities = entityStrings(out);
  const spans: Span[] = [];
  const claimed: boolean[] = new Array(text.length).fill(false);
  for (const { text: name, category } of entities) {
    const re = nameToRegex(name);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index, end = start + m[0].length;
      let overlap = false;
      for (let i = start; i < end; i++) if (claimed[i]) { overlap = true; break; }
      if (overlap) continue;
      for (let i = start; i < end; i++) claimed[i] = true;
      spans.push({ start, end, category, text: m[0], source: 'neural', score: 0.8 });
    }
  }
  return spans;
}
