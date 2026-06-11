// Self-hosted fonts (bundled into the build — no external/CDN request, so the
// "0 network calls" promise stays literally true).
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/800.css';
import '@fontsource/jetbrains-mono/400.css';
import './style.css';
import { detectPatterns, assignTokens, applyRedaction, reidentify, type Category, type Span, type Tokenized } from './patterns';
import { detectNames, isNamesLoaded } from './names';

// ---- category metadata (label + colour + which presets include it) ----
interface CatMeta { label: string; color: string; presets: Set<string>; }
const CATS: Record<Category, CatMeta> = {
  SIN:          { label: 'SIN',            color: '#ff7b6b', presets: new Set(['all', 'payroll', 'corporate', 't1']) },
  BN:           { label: 'Business #',     color: '#f0a93a', presets: new Set(['all', 'payroll', 'corporate']) },
  TRUST:        { label: 'Trust #',        color: '#f0c93a', presets: new Set(['all', 'corporate', 't1']) },
  CREDIT_CARD:  { label: 'Card',           color: '#e85aa0', presets: new Set(['all', 'payroll', 'corporate', 't1']) },
  BANK_ACCOUNT: { label: 'Bank acct',      color: '#5ad1e8', presets: new Set(['all', 'payroll', 'corporate', 't1']) },
  ADDRESS:      { label: 'Address',        color: '#c98cff', presets: new Set(['all', 'payroll', 'corporate', 't1']) },
  POSTAL:       { label: 'Postal code',    color: '#9a8cff', presets: new Set(['all', 't1', 'payroll']) },
  EMAIL:        { label: 'Email',          color: '#7ad17a', presets: new Set(['all', 'corporate', 't1', 'payroll']) },
  PHONE:        { label: 'Phone',          color: '#7ad1b0', presets: new Set(['all', 'corporate', 't1', 'payroll']) },
  HEALTH:       { label: 'Health #',       color: '#ff9ecf', presets: new Set(['all', 't1']) },
  PASSPORT:     { label: 'Passport',       color: '#d98c5f', presets: new Set(['all', 't1', 'corporate']) },
  DL:           { label: 'Licence',        color: '#b0a04a', presets: new Set(['all', 't1']) },
  PERSON:       { label: 'Name',           color: '#c9a227', presets: new Set(['all', 'payroll', 'corporate', 't1']) },
};

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const enabled = new Set<Category>(Object.keys(CATS) as Category[]);
const rejected = new Set<string>(); // span keys the user manually turned off
let currentText = '';
let patternSpans: Span[] = [];
let nameSpans: Span[] = [];
let currentSpans: Span[] = [];
let namesOn = false;
let tokens: Tokenized | null = null; // stable pseudonym map for the current render

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}
const spanKey = (s: Span) => `${s.start}:${s.end}:${s.category}`;

// ---- build the category toggle row ----
function buildToggles() {
  const box = $('#toggles');
  box.innerHTML = '';
  (Object.keys(CATS) as Category[]).forEach((cat) => {
    const m = CATS[cat];
    const el = document.createElement('label');
    el.className = 'toggle';
    el.innerHTML =
      `<span class="dot" style="background:${m.color}"></span>` +
      `<input type="checkbox" ${enabled.has(cat) ? 'checked' : ''} data-cat="${cat}" />` +
      `<span>${m.label}</span>`;
    el.querySelector('input')!.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.checked) enabled.add(cat); else enabled.delete(cat);
      render();
    });
    box.appendChild(el);
  });
}

function applyPreset(preset: string) {
  enabled.clear();
  (Object.keys(CATS) as Category[]).forEach((cat) => {
    if (CATS[cat].presets.has(preset)) enabled.add(cat);
  });
  buildToggles();
  render();
}

// ---- core: detect + render highlighted output ----
function recompute() {
  currentSpans = [...patternSpans, ...nameSpans].sort((a, b) => a.start - b.start);
}

function analyze(text: string) {
  currentText = text;
  patternSpans = detectPatterns(text);
  nameSpans = [];
  rejected.clear();
  recompute();
  render();
  if (namesOn && text.trim()) void runNames(); // re-run names if the layer is active
}

async function runNames() {
  const status = $('#status-line');
  const btn = $('#names-btn') as HTMLButtonElement;
  namesOn = true;
  btn.classList.add('active');
  btn.disabled = true;
  const first = !isNamesLoaded();
  btn.textContent = first ? 'Loading name model…' : 'Detecting names…';
  try {
    const found = await detectNames(currentText, (pct, label) => {
      if (first) { btn.textContent = `Loading model ${pct}%`; status.textContent = `Fetching name model (${label}) — model only, your text stays here.`; }
    });
    // drop name spans that overlap a pattern span (pattern wins)
    nameSpans = found.filter((n) => !patternSpans.some((p) => n.start < p.end && p.start < n.end));
    recompute();
    render();
    status.textContent = `Name detection on. ${nameSpans.length} name${nameSpans.length === 1 ? '' : 's'} found. Model cached — works offline now.`;
  } catch (err) {
    status.textContent = `Name model failed to load (${(err as Error).message}). Pattern redaction still works.`;
    namesOn = false; btn.classList.remove('active');
  } finally {
    btn.disabled = false;
    btn.textContent = namesOn ? 'Names: on' : 'Detect names';
  }
}

function activeSpans(): Span[] {
  return currentSpans.filter((s) => enabled.has(s.category) && !rejected.has(spanKey(s)));
}

function render() {
  const out = $('#output');
  if (!currentText.trim()) {
    out.innerHTML = '<p class="empty">Redacted preview appears here. Dollar amounts are kept on purpose — you want the AI to see the numbers.</p>';
    $('#summary').innerHTML = '';
    return;
  }
  // Tokenize the active (to-be-redacted) spans so each distinct entity shows its
  // stable pseudonym (PERSON 1, SIN 2…) — the differentiation the AI needs.
  tokens = assignTokens(activeSpans());
  const spans = [...currentSpans].sort((a, b) => a.start - b.start);
  let html = '';
  let cursor = 0;
  for (const s of spans) {
    if (s.start < cursor) continue;
    html += escapeHtml(currentText.slice(cursor, s.start));
    const on = enabled.has(s.category) && !rejected.has(spanKey(s));
    const m = CATS[s.category];
    if (on) {
      const tok = tokens.tokenForSpan.get(s) ?? s.category;
      html += `<mark class="tok" data-key="${spanKey(s)}" title="${m.label} — was: ${escapeHtml(s.text)} — click to reveal">${escapeHtml(tok.replace('_', ' '))}</mark>`;
    } else {
      html += `<mark class="tok off" data-key="${spanKey(s)}" title="${m.label} — click to re-redact">${escapeHtml(s.text)}</mark>`;
    }
    cursor = s.end;
  }
  html += escapeHtml(currentText.slice(cursor));
  out.innerHTML = html;
  out.querySelectorAll('mark.tok').forEach((el) => {
    el.addEventListener('click', () => {
      const key = (el as HTMLElement).dataset.key!;
      if (rejected.has(key)) rejected.delete(key); else rejected.add(key);
      render();
    });
  });
  renderSummary();
  renderRestore(); // keep the re-identify panel in sync with the current key
}

function renderSummary() {
  const counts: Partial<Record<Category, number>> = {};
  for (const s of activeSpans()) counts[s.category] = (counts[s.category] || 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) { $('#summary').innerHTML = ''; return; }
  const chips = Object.entries(counts)
    .map(([c, n]) => `<span class="chip"><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${CATS[c as Category].color};margin-right:6px"></span>${CATS[c as Category].label}: <b>${n}</b></span>`)
    .join('');
  $('#summary').innerHTML =
    `<span class="chip total"><b>${total}</b> item${total === 1 ? '' : 's'} redacted</span>` + chips;
}

function redactedText(): string {
  const active = activeSpans();
  return applyRedaction(currentText, active, tokens ?? assignTokens(active));
}

// ---- re-identify: turn the AI's tokenized reply back into real values, locally ----
function renderRestore() {
  const inEl = $('#restore-input') as HTMLTextAreaElement;
  const out = $('#restore-output');
  const reply = inEl.value;
  const reg = tokens?.registry;
  if (!reply.trim()) {
    out.innerHTML = '<p class="empty">Paste the AI\'s reply (the one still full of PERSON_1, SIN_1…). The tokens turn back into the real values right here — nothing is sent anywhere.</p>';
    return;
  }
  if (!reg || reg.size === 0) {
    out.innerHTML = '<p class="empty">Redact a document first (above) so there\'s a key to map the tokens back.</p>';
    return;
  }
  out.textContent = reidentify(reply, reg); // textContent = safe, no escaping needed
}

function downloadKey() {
  const reg = tokens?.registry;
  if (!reg || reg.size === 0) { flash($('#save-key'), 'Redact something first'); return; }
  // CSV: token,original — this IS the sensitive key, it stays on the user's machine.
  const rows = [['token', 'original_value'], ...[...reg.entries()]];
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'redaction-key.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---- inputs ----
function wireInputs() {
  const input = $('#input') as HTMLTextAreaElement;
  input.addEventListener('input', () => analyze(input.value));

  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('dragover'); }));
  drop.addEventListener('drop', (e) => {
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (f) loadFile(f);
  });
  ($('#file') as HTMLInputElement).addEventListener('change', (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) loadFile(f);
  });

  $('#names-btn').addEventListener('click', () => { void runNames(); });

  document.querySelectorAll('.preset').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('.preset').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      applyPreset((b as HTMLElement).dataset.preset!);
    }));

  $('#copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(redactedText());
    flash($('#copy'), 'Copied ✓');
  });
  $('#download').addEventListener('click', () => {
    const blob = new Blob([redactedText()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'redacted.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // re-identify panel
  $('#restore-input').addEventListener('input', renderRestore);
  $('#restore-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(($('#restore-output') as HTMLElement).textContent || '');
    flash($('#restore-copy'), 'Copied ✓');
  });
  $('#save-key').addEventListener('click', downloadKey);
}

async function loadFile(f: File) {
  const input = $('#input') as HTMLTextAreaElement;
  const status = $('#status-line');
  const lower = f.name.toLowerCase();
  const isPdf = f.type === 'application/pdf' || lower.endsWith('.pdf');
  const isImage = f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|tiff?|gif)$/.test(lower);

  // Photo or scan → OCR it in the browser.
  if (isImage) {
    status.textContent = `Reading ${f.name} in your browser…`;
    try {
      const { ocrImage, isOcrLoaded } = await import('./ocr'); // lazy — OCR engine only loads on demand
      const first = !isOcrLoaded();
      const text = await ocrImage(f, (pct, label) => {
        status.textContent = first
          ? `Loading OCR engine, then reading ${f.name} (${label} ${pct}%) — your image stays here.`
          : `Reading ${f.name} (${label} ${pct}%) — your image stays here.`;
      });
      input.value = text;
      analyze(text);
      status.textContent = text.trim()
        ? `${f.name}: read by on-device OCR. Double-check the text — OCR isn't perfect. Nothing was uploaded.`
        : `${f.name}: OCR found no readable text. Try a sharper scan or higher contrast.`;
    } catch (err) {
      status.textContent = `Couldn't OCR that image. (${(err as Error).message})`;
    }
    return;
  }

  if (isPdf) {
    status.textContent = `Reading ${f.name} in your browser…`;
    try {
      const { extractPdfText, rasterizePdf } = await import('./pdf'); // lazy — pdf.js only loads when a PDF is opened
      const res = await extractPdfText(f);
      if (res.looksScanned) {
        // No text layer → it's a scan. Rasterize the pages and OCR them.
        status.textContent = `${f.name} looks scanned — running on-device OCR…`;
        const { ocrCanvases } = await import('./ocr');
        const canvases = await rasterizePdf(f);
        const text = await ocrCanvases(canvases, (pct, label) => {
          status.textContent = `OCR: ${label}${pct ? ` ${pct}%` : ''} — pages stay on your device.`;
        });
        input.value = text;
        analyze(text);
        status.textContent = text.trim()
          ? `${f.name}: ${canvases.length} page${canvases.length === 1 ? '' : 's'} read by on-device OCR. Double-check the text. Nothing was uploaded.`
          : `${f.name}: OCR found no readable text on those pages.`;
      } else {
        input.value = res.text;
        analyze(res.text);
        status.textContent = `${f.name}: ${res.pages} page${res.pages === 1 ? '' : 's'} read locally. Nothing was uploaded.`;
      }
    } catch (err) {
      status.textContent = `Couldn't read that PDF. Try pasting the text instead. (${(err as Error).message})`;
    }
    return;
  }

  const text = await f.text(); // read locally, never uploaded
  input.value = text;
  analyze(text);
}

function flash(btn: HTMLElement, msg: string) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = old), 1200);
}

buildToggles();
wireInputs();
