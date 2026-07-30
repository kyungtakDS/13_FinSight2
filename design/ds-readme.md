# FinSight2 Design System

A monochrome-core, pastel-block marketing design system. The chrome — nav, body,
footer, CTAs — is strictly black and white; the storytelling lives in oversized
pastel **color-block sections** that take over whole viewports. Contrast is the
whole idea: monochrome chrome makes the color blocks feel intentional, and the
color blocks make the chrome feel like editorial paper instead of enterprise SaaS.

## Sources

This system was built entirely from a written design specification (a
`DESIGN.md`-style brief describing the brand's marketing canvas). **No codebase,
Figma file, logo, or brand assets were provided** — only the text spec. All hex
values, component definitions, and layout rules are transcribed from that brief;
pastel hex values are faithful approximations noted as such in the brief.

- Provided company name: **FinSight2**
- No design tooling / repo links were supplied. If you have the original
  source files, re-attach them and this readme can be reconciled against them.

## Font substitution (action needed)

The spec calls for proprietary **figmaSans** (variable sans) and **figmaMono**
(mono). Those binaries were not provided, so — per the brief's own recommendation
— we substitute **Inter** (fine variable weight axis) and **JetBrains Mono**,
loaded from Google Fonts in `tokens/fonts.css`. **Please provide the real font
files** (or confirm the substitutes) so the type renders exactly on-brand. When
you do, swap the `@font-face`/`@import` in `tokens/fonts.css` and the
`--font-sans` / `--font-mono` values in `tokens/typography.css`.

## Logo

**No logo mark was provided.** Wherever a mark belongs (top nav, footer,
thumbnail) the brand renders as the wordmark **FinSight2** set in display-weight
sans. No mark was drawn or reconstructed. Provide a logo SVG to replace the
wordmark.

---

## Content Fundamentals

How copy is written on this brand:

- **Voice: confident, plain, second-person.** Copy addresses the reader as
  "you" and the company as "we" ("we'll help you find the right plan"). Short
  declarative headlines: "Where teams design together", "Start building today".
- **Casing: sentence case everywhere** except the mono taxonomy labels
  (eyebrows, captions, footer column heads), which are **ALL-CAPS** with positive
  letter-spacing. Never title-case a headline.
- **No emoji.** The brand never uses emoji in marketing surfaces. Iconography is
  restrained (see Iconography).
- **Headlines are graphics, body is for reading.** Headlines are oversized and
  tightly tracked; body copy stays plain and even. Numbers/stats are used
  sparingly — the color blocks, not data, carry the energy.
- **Taxonomy vs. message.** Mono eyebrows flag *what a section is*
  ("DESIGN SYSTEMS", "PRICING", "RELEASE NOTES"); the sans headline delivers
  *the message*. Never set a paragraph in mono.
- **Verbs, not adjectives.** CTAs are actions: "Get started for free",
  "Contact sales", "Save your spot", "Choose Professional".

## Visual Foundations

- **Color.** Monochrome core (`--color-primary` black, `--color-canvas` white)
  carries every CTA, headline, and body line. Storytelling uses seven color
  blocks: lime, lilac, cream, mint, pink, coral, navy. One saturated magenta is
  reserved for a single promo CTA per page. **No mid-gray text** — body
  hierarchy comes from font *weight*, not opacity. Max one color block visible
  per viewport; white canvas always separates two blocks.
- **Type.** A single variable voice (Inter, sub. figmaSans) modulating at fine
  weight increments — 320, 330, 340, 450, 480, 540, 700 — with mono (JetBrains
  Mono, sub. figmaMono) for taxonomy only. Negative letter-spacing scales with
  size (-1.72px at 86px down to near-zero at body). Tight line-heights on display
  (1.00–1.10), generous on body (1.40–1.45).
- **Spacing.** 8px base unit; `--space-section` (96px) is the universal vertical
  rhythm between sections; `--space-xxl` (48px) is color-block interior padding.
  Max content width 1280px.
- **Backgrounds.** Flat color only — no gradients, no images-as-texture, no
  patterns. The change from white canvas to a pastel block *is* the section break.
- **Elevation.** Shadow-light by design. Level 0 (flat) is the default; cards use
  a 1px hairline border, never a shadow; soft shadows appear only on floating
  template tiles and dropdowns; strong shadow + scrim only on modals. Color
  blocks substitute for traditional elevation.
- **Shape.** Pill (`--radius-pill` 50px) is the only button shape; circle
  (`--radius-full`) for icon buttons and the comparison checkmark. Color blocks
  and pricing cards use `--radius-lg` (24px); image frames and inputs use
  `--radius-md` (8px). Never square off a CTA.
- **Motion.** Restrained. Buttons micro-scale on press (no color darken); the
  marquee strip scrolls linearly; template thumbnails animate in on scroll and
  keep their slight off-axis tilt across breakpoints. No bounces, no parallax.
- **Hover / press.** Hover = subtle opacity drop on links; press = ~0.94–0.97
  scale on buttons. Focus on inputs is a ring, never a fill change.
- **Corners / cards.** Cards are canvas with a hairline border and lg radius —
  no shadow, no colored left-border accent. Template tiles sit on surface-soft
  with md radius.

## Iconography

- The spec defines **no proprietary icon font or icon set.** Marketing surfaces
  are near-iconless: the only recurring glyphs are the **comparison checkmark**
  (green, in a canvas circle — rendered as an inline SVG in `CheckGlyph`) and
  simple **carousel/social chevrons** inside circular `IconButton`s.
- **No avatars** appear in marketing — the brand avoids personification.
- **No emoji, no unicode-as-icon** in production copy.
- If a broader icon set is needed for a build, substitute a restrained
  open-source line set (e.g. **Lucide**, 1.5–2px stroke) from CDN and flag the
  substitution — none ships with this system.

---

## Components

Reusable primitives, grouped under `components/`. Every component is a named
PascalCase export consumed via `window.FinSight2DesignSystem_56fb7f`.

- **Button** (`buttons/`) — the pill CTA; variants primary / secondary / tertiary / magenta.
- **IconButton** (`buttons/`) — circular icon button; default + inverse.
- **TextInput** (`forms/`) — form field, ring-only focus, input + textarea.
- **PricingTabs** (`pricing/`) — pill tier toggle; selected = primary surface.
- **CheckGlyph** (`pricing/`) — green comparison checkmark (glyph fill only).
- **ColorBlock** (`surfaces/`) — the signature pastel/navy story panel.
- **PricingCard** (`surfaces/`) — hairline-stroked tier card.
- **TemplateCard** (`surfaces/`) — surface-soft thumbnail tile with sticky-note tilt.
- **FeatureTile** (`surfaces/`) — large surface-soft composition tile.
- **PromoBanner** (`surfaces/`) — lilac banner carrying the single magenta CTA.
- **TopNav** (`navigation/`) — sticky white nav with the secondary+primary pill pair.
- **MarqueeStrip** (`navigation/`) — thin black scrolling ribbon.
- **Footer** (`navigation/`) — dense white footer link grid.

## UI Kits

- **`ui_kits/marketing/`** — interactive click-through of the marketing site:
  **Home** (hero → marquee → lime/navy/coral color blocks → template grid →
  closing CTA), **Pricing** (tier tabs, four `PricingCard`s, comparison matrix,
  lime FAQ block), and **Contact** (lilac promo banner + lime contact form).
  Open `index.html`; the floating router switches screens.

## Foundations (Design System tab)

Specimen cards live in `guidelines/`: color core, color blocks, surfaces,
semantic (Colors); display, headline/body, mono, weight axis (Type); spacing
scale (Spacing); radius scale, elevation (Shapes).

## Repo Map

- `styles.css` — global entry point (`@import` list only). Consumers link this.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `elevation.css`.
- `components/<group>/` — `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md` + one `*.card.html`.
- `guidelines/` — foundation specimen cards.
- `ui_kits/marketing/` — full-screen recreations.
- `thumbnail.html` — homepage tile.
- `SKILL.md` — Agent-Skills manifest for downloadable use.

## Intentional additions

None. Every component maps to a family defined in the source brief.
