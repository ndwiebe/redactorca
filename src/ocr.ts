// In-browser OCR for scanned/photo documents (tesseract.js). The image is
// turned into text entirely in the browser via WebAssembly — it is never
// uploaded. Lazy-loaded so the OCR engine only downloads when someone actually
// opens a scan or a photo, not on every visit.
//
// Like the name model, only the engine + language data are fetched (once, then
// cached by the browser); your document is processed locally. The Phase-3
// no-egress build self-hosts these assets so even that one fetch disappears.
import type { Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

export interface OcrProgress { (pct: number, label: string): void; }

export function isOcrLoaded(): boolean {
  return workerPromise !== null;
}

async function getWorker(onProgress?: OcrProgress): Promise<Worker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const { createWorker, OEM } = await import('tesseract.js');
    // OEM.LSTM_ONLY — the neural engine; smaller language data, better on
    // modern scans than the legacy engine.
    return createWorker('eng', OEM.LSTM_ONLY, {
      logger: (m: { status?: string; progress?: number }) => {
        if (onProgress && typeof m.progress === 'number') {
          onProgress(Math.round(m.progress * 100), m.status || 'working');
        }
      },
    });
  })().catch((e) => { workerPromise = null; throw e; });
  return workerPromise;
}

/** Tidy OCR output: collapse the ragged whitespace OCR emits, keep line breaks. */
function clean(text: string): string {
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** OCR a single raster image file (PNG / JPG / WEBP / etc.). */
export async function ocrImage(file: File, onProgress?: OcrProgress): Promise<string> {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(file);
  return clean(data.text);
}

/** OCR a set of rendered pages (used for image-only / scanned PDFs). */
export async function ocrCanvases(canvases: HTMLCanvasElement[], onProgress?: OcrProgress): Promise<string> {
  const worker = await getWorker(onProgress);
  const out: string[] = [];
  for (let i = 0; i < canvases.length; i++) {
    onProgress?.(0, `page ${i + 1} of ${canvases.length}`);
    const { data } = await worker.recognize(canvases[i]);
    out.push(data.text);
  }
  return clean(out.join('\n\n'));
}
