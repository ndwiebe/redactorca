// Self-hosted fonts (bundled into the build — no external/CDN request, so the
// "0 network calls" promise stays literally true).
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/800.css';
import '@fontsource/jetbrains-mono/400.css';
import './style.css';
import { detectPatterns, type Category, type Span } from './patterns';

// ---- category metadata (label + colour + which presets include it) ----
interface CatMeta { label: string; color: string; presets: Set<string>; }
const CATS: Record<Category, CatMeta> = {
  SIN:          { label: 'SIN',            color: '#ff7b6b', presets: new Set(['all', 'payroll', 'corporate', 't1']) },
  BN:           { label: 'Business #',     color: '#f0a93a', presets: new Set(['all', 'payroll', 'corporate']) },
  TRUST:        { label: 'Trust #',        color: '#f0c93a', presets: new Set(['all', 'corporate', 't1']) },
  CREDIT_CARD:  { label: 'Card',           color: '#e85aa0', presets: new Set(['all', 'payroll', 'corporate', 't1']) },
  BANK_ACCOUNT: { label: 'Bank acct',      color: '#5ad1e8', presets: new Set(['all', 'payroll', 'corporate', 't1']) },
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
let currentSpans: Span[] = [];

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
function analyze(text: string) {
  currentText = text;
  currentSpans = detectPatterns(text);
  rejected.clear();
  render();
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
  const spans = [...currentSpans].sort((a, b) => a.start - b.start);
  let html = '';
  let cursor = 0;
  for (const s of spans) {
    if (s.start < cursor) continue;
    html += escapeHtml(currentText.slice(cursor, s.start));
    const on = enabled.has(s.category) && !rejected.has(spanKey(s));
    const m = CATS[s.category];
    // When redacted, the real text is replaced by block glyphs (not just hidden
    // under CSS) so it can't be selected or copied out of the preview.
    const body = on ? '█'.repeat([...s.text].length) : escapeHtml(s.text);
    html += `<mark class="bar ${on ? '' : 'off'}" data-key="${spanKey(s)}" title="${m.label} — click to ${on ? 'reveal' : 're-redact'}">${body}</mark>`;
    cursor = s.end;
  }
  html += escapeHtml(currentText.slice(cursor));
  out.innerHTML = html;
  out.querySelectorAll('mark.r').forEach((el) => {
    el.addEventListener('click', () => {
      const key = (el as HTMLElement).dataset.key!;
      if (rejected.has(key)) rejected.delete(key); else rejected.add(key);
      render();
    });
  });
  renderSummary();
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
  const spans = activeSpans().sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const s of spans) {
    if (s.start < cursor) continue;
    out += currentText.slice(cursor, s.start) + `[${s.category}]`;
    cursor = s.end;
  }
  return out + currentText.slice(cursor);
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
}

async function loadFile(f: File) {
  const input = $('#input') as HTMLTextAreaElement;
  const status = $('#status-line');
  if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
    status.textContent = `Reading ${f.name} in your browser…`;
    try {
      const { extractPdfText } = await import('./pdf'); // lazy — pdf.js only loads when a PDF is opened
      const res = await extractPdfText(f);
      input.value = res.text;
      analyze(res.text);
      status.textContent = res.looksScanned
        ? `${f.name}: little text found — looks scanned. OCR for photos/scans is coming next.`
        : `${f.name}: ${res.pages} page${res.pages === 1 ? '' : 's'} read locally. Nothing was uploaded.`;
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
