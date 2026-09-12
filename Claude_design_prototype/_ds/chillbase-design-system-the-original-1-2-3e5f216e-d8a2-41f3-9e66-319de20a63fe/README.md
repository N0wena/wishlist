# ChillBase Design System

> **ChillBase** is a game studio ("наша студия", "наш путь"). Their identity is built around three hero colors — **black, red, white smoke** — and a wide, bold display type system in **Good Headline Pro**, paired with **Onest** for body. The brand voice is bold, manifesto-tone, Russian-first ("Мы не просто следуем за тенденциями — мы бросаем им вызов"). Visuals lean into dark surfaces, grid/dot textures, geometric CGI renders, a circular red/pixel wordmark, and a small roster of product stickers (OneState, Imba, B., Холод, FF).

This folder is the design system that design agents can read when generating ChillBase-branded artifacts (mocks, slides, decks, prototypes, production stubs).

## Sources consumed

- **Figma:** `ChillBase айдентика.fig` — 7 pages incl. `/Style-Guide` (81 frames: Philosophy, Logo, Fonts, Colors, Backgrounds, Color Spots, Motion, Renders, External-Identity, Internal-Identity, Covers).
- **Codebase / local folder:** `ChillBase/` (read-only mount).
  - `ChillBase/Ассеты/` — canonical logos, fonts, backgrounds, stickers, geometric SVGs, numbers, renders.
  - `ChillBase/chillbase-pptx/SKILL.md` — ChillBase PPTX generator skill (pptxgenjs, "restrained edition" tokens).
  - `ChillBase/chillbase-pptx-images/SKILL.md` — image-assembled PPTX skill.
  - `ChillBase/chillbase-web/` — web scaffolding (mostly server + uploads).
  - `ChillBase/Презентации/`, `ChillBase/Шаблоны/` — sample brand material (not exhaustively read).
- **Uploaded logos:** 15 SVGs in `uploads/` (horizontal + vertical, full-color / grayscale / inverted / reverse / one-color variants of the combined logo, plus the wordmark alone).
- **Website (noted):** https://chillbase.net — referenced for motion cues.

## Products represented

The identity book and PPTX skill reference three games as sticker lockups:

- **OneState** — flagship open-world driving title (present in both stickers and PPTX data).
- **Imba** — secondary title (sticker).
- **B / Холод / FF** — working-title projects or studio sub-marks.

For UI kits we build two surfaces the studio actually ships:
1. **ChillBase presentation / poster system** (decks, covers) — the system's primary output.
2. **ChillBase marketing site** (chillbase.net) — a one-page studio site.

## At a glance — content fundamentals

Tone: **manifesto, declarative, confident, slightly aggressive.** Short clauses, em-dashes, 1st-person plural ("Мы"). Self-positioning as rule-breakers: *"Мы здесь не для того, чтобы вписываться в формы — мы здесь, чтобы их разбить."* Language is **Russian-first**, with English titles/labels ("CHILLBASE", "STYLE-GUIDE", section numbers like "05.1 / № / цвета"). Numerals are typeset as images on posters (the `assets/numbers/` set).

Casing: **UPPERCASE** for display type, mixed case for body. Section labels appear in paired lockups — English mark on the left, Russian descriptor on the right ("CHILLBASE ──────── айдентика").

Emoji: **not used**. Iconography is stickers (PNG characters) and geometric SVGs. No outline icon system.

## At a glance — visual foundations

- **Palette:** three hero colors (black `#121212`, red `#ff0000`, white smoke `#f4f5f0`) + a warm orange accent `#ff7e00` for data/highlights + rare lime/violet used only in stickers.
- **Typography:** Good Headline Pro Wide (Bold/Black/Ultra) for display; Onest for body; wide tracking (0.03em baseline).
- **Backgrounds:** dark, gridded — the repeating 200×200 grid pattern is the most-used component (556 instances). Dot grids, soft red/orange "bliki" glows, and noise layers sit over `#121212`.
- **Motion:** the site uses smooth vertical scrolling sections with gentle parallax; logo loop animation; no bouncy spring physics. Easing feels like `cubic-bezier(0.2, 0.8, 0.2, 1)` with 400–700ms durations.
- **Radii:** cards ≈8px, buttons 8–12px, stat chips 4px, display posters use hard 0-corner blocks.
- **Borders:** thin (1px / 0.75pt in PPTX) `#2f2f2f` on cards; occasional 1.2pt red accent border.
- **Shadows:** minimal — occasional red/orange glow from the "bliki" background; no drop shadows on flat type.
- **Imagery:** warm, glossy CGI renders (often with motion blur), glass/chrome geometry, dark photography with red accent lighting.

(See dedicated CONTENT FUNDAMENTALS and VISUAL FOUNDATIONS sections below for the full audit.)

---

## CONTENT FUNDAMENTALS

### Voice
- **Point of view:** 1st-person plural ("мы"), never "вы". The brand speaks *as* the studio.
- **Register:** manifesto. Short, declarative sentences. Em-dashes for contrast ("— это правило, а не исключение"). Frequent rhetorical rhythm: *"Бесстрашие, дерзость и подлинная уникальность — вот наш путь."*
- **Assertiveness:** confident bordering on confrontational. Anti-convention framing ("мы бросаем им вызов", "разбить формы").
- **Language mix:** Russian body copy; English for section labels, product names, numeric labels ("CHILLBASE", "STYLE-GUIDE", "THANK YOU"). Headings on the PPTX skill are bilingual (RU + EN dual-lang slide).

### Casing & punctuation
- Display headlines: **UPPERCASE** with wide tracking (0.03em). Product names ("OneState", "Imba") keep their intended case.
- Body paragraphs: normal sentence case.
- Hyphenation used intentionally on posters to justify columns ("переша-гивая", "отка-зываются") — this is typeset, not prose style; don't copy the hyphens into new content.
- Section tagging: `01.1 / № / айдентика` pattern on the left rail of every style-guide spread.

### Vocabulary
- Game-industry: игроки, игровые механики, повествование, дизайн.
- Self-positioning: студия, инновации, экспертиза, путь, уникальность.
- Product stickers carry their own tone — playful single-word marks (Холод, Имба, Ф, B).

### Emoji & special characters
- **No emoji.**
- Em-dashes, arrows used in section headers.
- Unicode minus (`\u2212`) is preferred for numeric deltas in decks (per SKILL.md).

### Examples
> "Наша студия основана на смелых инновациях и дерзком вызове. Мы не просто следуем за тенденциями — мы бросаем им вызов, перешагивая границы и заново определяя, что такое игра."

> "Мы создаем для игроков, которые требуют больше, чем обычные игры. Мы здесь не для того, чтобы вписываться в формы — мы здесь, чтобы их разбить."

> "Значок можно использовать вместе со словесным знаком или отдельно. Ни в коем случае нельзя изменять, искажать или перерисовывать логотип."

---

## VISUAL FOUNDATIONS

### Color
- **Hero palette (use always):** `#121212` Black · `#ff0000` Red · `#f4f5f0` White Smoke.
- **Neutral ladder:** `#1a1a1a`, `#242424`, `#2f2f2f`, `#353436`, `#737373`, `#979797`, `#bfbfbf`, `#d9d9d9`, `#f4f5f0`.
- **Accents (restrained edition — QBR/official):** orange `#ff7e00` for bar fills, stats, highlights; red `#ff0000` ≤1 element per slide for key targets.
- **Editorial accents (rare):** lime `#cbec55`, violet `#7b5aea`. Used exclusively in product stickers (OneState, Imba) and never as UI color.
- **Rules:** black is the canvas. Red is accent, not body. White smoke is text on dark. Keep red to ≤10% of surface area.

### Typography
- **Display:** Good Headline Pro. Used weights: Wide, Wide Bold, Wide Black, Black, Bold, Wide News, Wide Medium, Wide Light. Always UPPERCASE for hero type. Tracking 0.03em.
- **Body:** Onest. Used weights: Light, Regular, Medium, SemiBold, Bold, Black. Size 12–20px at screen scale; 13–15pt in decks.
- **Scales:** See `colors_and_type.css`. Hero posters scale all the way to 300px for a triple-letter ABC treatment.
- **Mixed runs:** display + body co-occur in cards — big Good Headline Pro title, then Onest body beneath at 16–18px.

### Spacing
- Base unit **4px**. Common steps: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Deck margin ≥ 0.8" (≈76px at 1920). Content columns sit at ~645px wide (the style-guide left rail).

### Backgrounds
- **Dark by default.** `#121212` filled surface is the most common.
- **Grid pattern** (200×200 repeating) — single most-used component (556 instances). Applied as a subtle texture over black; edges fade via gradient.
- **Dot pattern** — alternate texture (471 instances).
- **Bliki** — a warm red/orange radial glow on black. Used on title and section openers. Two variants (one hotspot vs. multiple).
- **Noise** — gentle grain layer over gradients on posters.
- **Full-bleed renders** — CGI product imagery breaks through on covers.

### Imagery
- Warm (red/orange) lighting.
- Glossy CGI renders of geometric forms (icosahedra, waves, peaks, vortex, fabric, saddle, shell, cube, starburst, mountain).
- Photographic renders with motion blur for covers.
- Minor PNG sticker set for social/culture use.
- No grain on product shots; grain only on backgrounds.

### Motion
- Reference: chillbase.net.
- **Easing:** smooth-out (`cubic-bezier(0.2, 0.8, 0.2, 1)`), not bouncy.
- **Durations:** 300–700ms; hero loops 1200–2000ms.
- **Hover:** opacity 1 → 0.8, or scale 1 → 0.96 on cards.
- **Press:** scale 1 → 0.98, brief (~120ms).
- **Scroll:** crisp section snaps, subtle vertical parallax, no horizontal carousel gimmicks.
- **Loading:** red pulsing dot (see `assets/backgrounds/red-dot.png`) — the brand's "liveness" cue.
- Never: 3D card flips, rainbow gradients, confetti, springy bounces.

### Borders & elevation
- **Borders:** 1px solid `#2f2f2f` on cards at rest; 1.2px `#ff7e00` or `#ff0000` for emphasis.
- **Shadows:** `0 8px 24px rgba(0,0,0,.45)` for lifted cards; red glow `0 0 48px rgba(255,0,0,.45)` for hero focus.
- **No protection gradients** behind text — the dark canvas provides enough contrast. Capsules/pills are used for tags and badges.

### Transparency & blur
- Minimal use of backdrop-blur. Small amounts (≤12px) under sticky headers.
- Color Spots Glass Effect (from Figma) are the closest thing to a "glass" language — a soft color wash at ~25% opacity on dark.

### Corner radii
- Cards: 8px.
- Buttons: 8–12px.
- Pills/tags: 999px.
- Input fields: 10px.
- Display/poster blocks: 0.

### Cards
- Dark surface `#1a1a1a`, 1px `#2f2f2f` border, 8px radius. Body padding 24–32px.
- Accent variant: same, but border color `#ff7e00` (or `#ff0000` for the hero card).
- **No** bluish-purple gradients, **no** colored-left-border patterns, **no** emoji inside cards.

### Layout rules
- Fixed top rail (80–96px) or no chrome at all on posters.
- Logo anchored bottom-left on deck slides (1.21" × 0.30" at 13.33×7.5 canvas).
- Page number bottom-right, `"01 / 16"` format, tracked, dim grey.
- Thin `#2f2f2f` horizontal rules separate meta-sections.

---

## ICONOGRAPHY

ChillBase does **not** have a conventional outlined icon system. Iconic language is built from three sources:

1. **Product stickers** — PNGs with strong colors and rounded illustration style (`assets/stickers/`). These are the studio's mascot-style marks: `star-filled`, `star-ring`, `heart`, `popper`, `smile`, `cake`, `holod`, `Imba`, `OneState`, `B`, `FF`, `earth`. Use them for culture moments (birthdays, launches, celebrations) — NOT as UI chrome.
2. **Geometric SVGs** — 40+ abstract geometric marks (`assets/geo/shape-01.svg` … `shape-10.svg`, with more available in `ChillBase/Ассеты/Изображения/Геометрические фигуры/`). Each has four numbered variants. These replace "hero graphics" in posters and slide headers.
3. **Number glyphs** — `assets/numbers/001.png` … `009.png`: large display numerals as imagery (used for numbered steps in decks).

For **standard UI affordances** (chevrons, checkmarks, carets, close-X, search, menu) — where a real icon set is needed — we use **Lucide** (`https://unpkg.com/lucide@latest`). Rationale: Lucide's 1.5px-stroke line style matches the crisp, wide, dark-surface aesthetic better than Heroicons or Feather. This is a **substitution** — no in-house icon font exists. Flagging this for user review.

**Emoji:** never.
**Unicode:** em-dash `—`, arrow `→`, unicode minus `\u2212` for typography.

---

## INDEX — files in this system

Root:
- `README.md` (this file).
- `SKILL.md` — Claude Code skill manifest.
- `colors_and_type.css` — tokens + base element styles.
- `preview/` — design-system cards (each renders as a review card).
- `assets/`
  - `logos/` — 15 SVG logo variants.
  - `backgrounds/` — 7 canonical backgrounds (grid, dots, bliki, red-dot).
  - `decor/` — 6 decorative layers (gradient, soft spots, pixel logo).
  - `stickers/` — 13 PNG product/mood stickers.
  - `geo/` — 10 geometric SVG shapes.
  - `numbers/` — 9 numeral PNGs.
- `fonts/` — Onest TTFs (Light → Black). **Good Headline Pro is NOT shipped** (licensed Adobe font).
- `ui_kits/`
  - `presentation/` — slide + poster system.
  - `web/` — chillbase.net-style marketing site.
- `slides/` — sample slides (title, divider, content, metrics, thank-you).

## PRESENTATION RULES (canonical)

**All presentations MUST use `ui_kits/presentation_template/` as their starting point.** Do not build decks from scratch, do not re-derive chrome, do not invent a new slide layout system. Copy the kit, extend it.

### Required usage
- **Base file:** `ui_kits/presentation_template/index.html` (plus `frame.jsx`, `slides.jsx`, `slides_extra.jsx`). Copy the whole folder into the target project and rename slides as needed.
- **Shared chrome:** every non-cover, non-final slide must use `<HRFrame page={N}>` from `frame.jsx`. Do not reimplement the top/bottom meta rails, page numbers, or rule lines.
- **Type tokens:** use `HRTitle`, `HREyebrow`, `HRBody`, `HRCard` helpers. Display type = Good Headline Pro / Archivo UPPERCASE, body = Onest. Never inline-override the font-family.
- **Canvas:** 1920×1080. Dark surface `#121212`. Content padding = 80px sides / 140px top-bottom (handled by `HRFrame`).
- **Accent:** `#ff0000` by default, ≤10% of surface area. The `HRTheme` context drives the accent color — respect it, don't hardcode red.
- **Outer slide margin:** +16px outside the frame (letterbox gap between slide edge and viewport), as in `Patterns.html`.

### Cover + final slide
- **Cover (slide 01)** and **final slide (last)** MUST use the animated `PatternLayer` component from `frame.jsx`:
  - Cover → `<PatternLayer variant="grid" count={22} seed={1} />`
  - Final → `<PatternLayer variant="dot" count={45} seed={99} />`
- The pattern uses uniform cells (no vignette, no zoning), inner inset = one cell size, and 3×3 px red pulse dots at random nodes with slow, rare blinking (4–7.5s pulse, up to 9s delay). Do not change these values without a design reason.
- No horizontal tracer dots. No dot-size variance. No glowing shadow on the red pulses.

### Required slide vocabulary
The template ships 21 ready layouts — pick from these before inventing anything new:

| # | Layout | Component |
|---|---|---|
| 01 | Cover with animated grid pattern | `HR01Cover` |
| 02 | Agenda (2-column) | `HR02Agenda` |
| 03 | Section divider (huge numeral) | `HR03Section` |
| 04 | Text + image card | `HR04TextImage` |
| 05 | Image + text + metrics | `PT05ImageText` |
| 06 | Report: 3 stacked line charts (6 months) | `PT06ReportCharts` |
| 07 | Two charts side-by-side (bars + donut) | `PT07TwoCharts` |
| 08 | Text-heavy manifesto (2-column) | `PT08TextHeavy` |
| 09 | Info table (portfolio-style) | `PT09InfoTable` |
| 10 | Full-bleed image with grid overlay + title | `PT10FullBleed` |
| 11 | Quote | `HR05Quote` |
| 12 | KPI metrics (4 cards) | `HR06Metrics` |
| 13 | Timeline | `HR07Timeline` |
| 14 | Process steps | `HR08Process` |
| 15 | Comparison table | `HR09Table` |
| 16 | Donut chart + legend | `HR10Donut` |
| 17 | Progress bars | `HR11Progress` |
| 18 | Team profiles | `HR12Team` |
| 19 | Benefit cards grid | `HR13Cards` |
| 20 | FAQ | `HR14FAQ` |
| 21 | Final / Q&A with animated dot pattern | `HR15Contacts` |

### Forbidden in presentations
- Bluish-purple gradients, rainbow gradients, drop-shadow halos on text.
- Emoji as content or chrome.
- Colored left-border accent cards.
- Carousels, 3D flips, spring/bounce motion.
- Ad-hoc slide chrome (don't reinvent headers/footers).
- Hardcoded colors — use `HR_COLORS.*` or `colors_and_type.css` tokens.
- Icon fonts. Use Lucide only for utility glyphs; hero graphics come from `assets/geo/` or stickers.

### When a new layout is genuinely needed
Add it as a new `PT{N}{Name}` component alongside the existing ones, use `HRFrame` for chrome, and register it in `SLIDES` in `index.html`. Don't fork the kit.

## Known substitutions / things to flag

- **Good Headline Pro** (Adobe Fonts) cannot be bundled. Closest free substitute: **Archivo** with weights 800/900 and `letter-spacing: 0.03em`. In production, license Good Headline Pro from Adobe Fonts and swap the `--font-display` stack. **Please provide the GHP font files if you'd like pixel accuracy.**
- **Iconography** uses Lucide as a CDN fallback since no in-house icon set exists.
- Figma page 6 contains a large pool of unsorted media and character renders — a small representative subset is imported; the full set remains in `ChillBase/Ассеты/`.
