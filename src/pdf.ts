// In-browser PDF text extraction (pdf.js). Born-digital PDFs only for now —
// the text layer is read locally, no upload. Scanned/image PDFs (no text layer)
// return little or nothing; OCR is a separate later layer.
import * as pdfjs from 'pdfjs-dist';
// Vite resolves the worker to a bundled, same-origin URL — no CDN, preserving
// the zero-network promise.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfExtract {
  text: string;
  pages: number;
  /** true when almost no text came out — likely a scan needing OCR. */
  looksScanned: boolean;
}

export async function extractPdfText(file: File): Promise<PdfExtract> {
  const buf = await file.arrayBuffer(); // read locally; never uploaded
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Reconstruct lines from positioned items: group by y, sorted by x, so
    // tables and columns survive as readable text (the pattern layer is
    // layout-independent, but readable output matters for the preview).
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      if (!('str' in item)) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x, s: item.str });
    }
    const ys = [...rows.keys()].sort((a, b) => b - a); // top to bottom
    for (const y of ys) {
      const line = rows.get(y)!.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();
      if (line) parts.push(line);
    }
    parts.push(''); // page break
  }
  const text = parts.join('\n').trim();
  return {
    text,
    pages: doc.numPages,
    looksScanned: text.replace(/\s/g, '').length < 20 * doc.numPages,
  };
}

/**
 * Render every page of a PDF to a canvas, so a scanned / image-only PDF (no text
 * layer) can be handed to OCR. Rendering happens in the browser; nothing leaves.
 * `scale` 2 roughly doubles raster resolution, which materially improves OCR
 * accuracy on small print at an acceptable memory cost.
 */
export async function rasterizePdf(file: File, scale = 2): Promise<HTMLCanvasElement[]> {
  const buf = await file.arrayBuffer(); // read locally; never uploaded
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const canvases: HTMLCanvasElement[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}
