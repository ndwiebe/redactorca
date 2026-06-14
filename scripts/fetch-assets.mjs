// Fetch + vendor the self-hosted detection assets into public/ so the app runs
// with ZERO third-party network calls (the core trust guarantee). These assets are
// gitignored (178MB model + WASM); run this once after `npm install`, or in CI/deploy.
//
//   node scripts/fetch-assets.mjs
//
// Production (Cloudflare Pages): the model is too large for the 25 MiB/file Pages
// limit, so it lives in R2 and is served same-origin via a Pages Function — see
// SELF-HOST.md. The WASM + tesseract assets are small enough to ship as Pages static
// files. This script populates everything for LOCAL no-egress dev/testing.
import { mkdir, copyFile, writeFile, access, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NM = join(ROOT, 'node_modules');

const MODEL_ID = 'Xenova/bert-base-multilingual-cased-ner-hrl';
const HF = `https://huggingface.co/${MODEL_ID}/resolve/main`;
const MODEL_DIR = join(ROOT, 'public', 'models', MODEL_ID);
const ORT_DIR = join(ROOT, 'public', 'ort');
const TESS_DIR = join(ROOT, 'public', 'tesseract');

const log = (m) => process.stdout.write(`${m}\n`);

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function download(url, dest) {
  if (await exists(dest)) { log(`  skip (have)  ${dest.replace(ROOT + '/', '')}`); return; }
  await mkdir(dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  log(`  got ${(buf.length / 1e6).toFixed(1)}MB  ${dest.replace(ROOT + '/', '')}`);
}

async function copyLocal(src, dest) {
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
  log(`  copied        ${dest.replace(ROOT + '/', '')}`);
}

log('NER model (Hugging Face, one-time):');
for (const f of ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json']) {
  await download(`${HF}/${f}`, join(MODEL_DIR, f));
}
await download(`${HF}/onnx/model_quantized.onnx`, join(MODEL_DIR, 'onnx', 'model_quantized.onnx'));

log('ONNX-runtime WASM + loaders (from node_modules):');
// ORT fetches BOTH the .mjs glue and the .wasm binary from wasmPaths, and picks a
// variant at runtime (jsep / asyncify / jspi / plain) by feature detection — so
// vendor every ort-wasm-simd-threaded.* file, not just one.
const ortDist = join(NM, 'onnxruntime-web', 'dist');
for (const f of (await readdir(ortDist)).filter((n) => /^ort-wasm-simd-threaded\..*\.(mjs|wasm)$|^ort-wasm-simd-threaded\.(mjs|wasm)$/.test(n))) {
  await copyLocal(join(ortDist, f), join(ORT_DIR, f));
}

log('Tesseract worker + core + language (from node_modules + tessdata):');
await copyLocal(join(NM, 'tesseract.js', 'dist', 'worker.min.js'), join(TESS_DIR, 'worker.min.js'));
for (const f of ['tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm.js']) {
  await copyLocal(join(NM, 'tesseract.js-core', f), join(TESS_DIR, f));
}
await download('https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz', join(TESS_DIR, 'eng.traineddata.gz'));

log('\nDone. The app now runs fully local — start with `npm run dev` and watch the');
log('network panel: every request should be same-origin. Production: see SELF-HOST.md.');
