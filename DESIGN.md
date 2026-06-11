# DESIGN — RedactorCA

## Theme: LIGHT (warm paper)
Scene that forces it: a CPA at a desk in daytime office light, anxious about a client file, wanting calm reassurance. That is paper and ink, not a dark terminal. Light is also the anti-reflex move (every privacy/fintech tool defaults to dark).

## Color (OKLCH, tinted neutrals — never #fff/#000)
- `--paper`   oklch(0.975 0.008 85)  — warm off-white background
- `--paper-2` oklch(0.945 0.010 85)  — raised surface / input wells
- `--ink`     oklch(0.23 0.012 70)   — warm near-black text + the redaction bars
- `--ink-soft` oklch(0.46 0.010 70)  — secondary text
- `--line`    oklch(0.89 0.010 80)   — hairline borders
- `--accent`  oklch(0.50 0.085 195)  — deep petrol/teal: calm, secure, NOT navy/gold/neon. Links, CTA, trust.
- `--accent-soft` oklch(0.95 0.03 195) — accent tint for the trust panel
Strategy: Restrained — warm-paper neutrals + ink + one petrol accent. The "color event" is the black redaction bars, not a saturated surface.

## Type (self-hosted via @fontsource — NO CDN, the 0-network promise is sacred)
- Display + UI: **Hanken Grotesk** (warm, exact, highly legible; off the reflex-reject list — not Inter/Plex). Hero at 800; body 400/500; labels 600.
- Document/redaction preview: **JetBrains Mono** (clean, off the reject list — not IBM Plex Mono / Space Mono).
- Scale: fluid clamp() for the hero, ≥1.25 step ratio.

## Layout
Single confident scroll, left-aligned, asymmetric — not a centered icon-title-card stack.
1. **Hero**: oversize headline that states the promise, with a live redaction micro-animation on the key phrase (real text → ink bar). The trust line sits with it. The redaction-bar motif is the art direction; no stock photo needed (the live tool is the imagery).
2. **The tool**: the working redactor (paste/drop → live preview → copy/download), framed as "try it, watch the network tab stay empty."
3. **Reassurance band**: 3 plainspoken proofs of the local-first claim (no upload / no account / works offline after first load).
4. Footer.

## Redaction rendering (the craft detail)
Detected PII renders as a **solid ink bar** (the real redaction look), not rainbow highlights — that is the product's truth and reads premium. Category identity lives in the hover tooltip + the summary chips + the toggle legend dots, not in the bar color. Click a bar to reveal/toggle it (human-in-the-loop). Dollar amounts are never barred.

## Motion (restrained, ease-out only, respects reduced-motion)
- One hero entrance: the key phrase types/settles, then a black bar wipes across it (ease-out-expo). Loops slowly or runs once.
- Bars in the live preview wipe in left-to-right on detect (120–180ms). No bounce.

## Bans honored
No gradient text, no glassmorphism, no side-stripe borders, no hero-metric template, no identical card grids, no em dashes in copy, no emoji icons (SVG only), no IBM Plex / Inter, no dark-terminal reflex.
