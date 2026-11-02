---
name: CashRetrait
description: Le moins cher pour retirer et envoyer, lu comme un tableau des tarifs de gare routière.
colors:
  board: "#1c2f86"
  board-deep: "#15246b"
  board-ink: "#ffffff"
  board-ink-2: "#c9d4f5"
  stripe: "#6fc7e0"
  ground: "#e9eef5"
  surface: "#ffffff"
  ink: "#101b3a"
  ink-2: "#44506b"
  rule: "#c3ccdb"
  plate: "#ffffff"
  plate-ink: "#101b3a"
  good: "#0b6e57"
  warn-bg: "#fff1cc"
  warn-ink: "#5c3b00"
  dark-ground: "#0b1226"
  dark-surface: "#141e3b"
  dark-ink: "#e8edf7"
  dark-ink-2: "#a9b4cc"
  dark-board: "#14205a"
  dark-plate: "#dce4f5"
  dark-plate-ink: "#0d1733"
  dark-accent-line: "#8fb4ff"
typography:
  display:
    fontFamily: "Barlow Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.05
  headline:
    fontFamily: "Barlow Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
  numeral:
    fontFamily: "Barlow Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum, lnum"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  lead:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.45
  small:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  plate: "6px"
  segment: "8px"
  panel: "12px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  plate-s:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.plate}"
    padding: "4px 8px"
  plate-l:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.plate}"
    padding: "8px 14px"
  appbar:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    height: "56px"
  navbar:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink-2}"
    height: "68px"
  navbar-item-active:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.board}"
    rounded: "{rounded.plate}"
    size: "56px x 32px"
  segment-selected:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.segment}"
    height: "48px"
  board-list:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  board-row:
    height: "64px"
    padding: "12px 16px"
  button-on-board:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.board}"
    rounded: "{rounded.panel}"
    height: "48px"
---

# Design System: CashRetrait

## Overview

**Creative North Star: "The Fare Board"**

CashRetrait reads like the painted tariff board at a Malagasy gare routière: a deep ultramarine board, a thin sky-blue coachwork pinstripe, and the price of each line lettered on a white plate you can read from three metres away. People come to it with one question (how much will this cost me?) and the answer is always a number on a plate.

The shell is an Operate surface: standard top bar, bottom navigation, lists, segmented controls, steppers. The world contributes only palette, the condensed numeral face, density and one signature move, the **price plate**. Everything else is plain, large and familiar for low/mid-range Android phones at 360 px.

It refuses the fintech default (white cards on grey, gradient balance hero, brand-coloured CTA) and it never borrows an operator's identity: the three operators are told apart by name and a neutral monogram, never by their colours or logos.

**Key Characteristics:**
- Ultramarine board above and below, cool enamel ground between.
- Numbers on white plates, set in Barlow Condensed 600 with tabular figures.
- Thin coachwork pinstripe (`--stripe`) separating board from content.
- Big targets: 48 px minimum, 64 px rows, 68 px nav.
- Light and dark from `prefers-color-scheme`; same structure in both.

## Colors

A restrained board-and-enamel palette: one committed blue for the shell, cool neutrals for content, colour reserved for state.

### Primary
- **Coachwork Ultramarine** (#1c2f86): app bar, bottom nav, selected segment, primary icon tint in light mode. Dark: #14205a.
- **Board Shadow** (#15246b): the 2 px band between the board and the pinstripe.
- **Pinstripe Sky** (#6fc7e0): the 2 px coachwork line under the header and above the nav. Decorative only, never text. Dark: #4fa9c4.

### Neutral
- **Enamel Ground** (#e9eef5): page background (light). Dark: #0b1226.
- **Plate White** (#ffffff): price plates, list panels, notice boxes. Dark plates stay light (#dce4f5) so the signature survives at night; dark panels are #141e3b.
- **Board Ink** (#101b3a): body text and plate numerals. Dark text: #e8edf7.
- **Faded Ink** (#44506b): secondary text, help, disclaimer (6.9:1 on ground). Dark: #a9b4cc.
- **Rule** (#c3ccdb): 1 px dividers and panel borders. Dark: #2a3760.
- **Board Ink 2** (#c9d4f5): secondary text on the board (7.9:1).

### State
- **Savings Green** (#0b6e57 / dark #5fd3b0): savings and "cheapest" only (Tasks 12–13).
- **Stale Amber** (bg #fff1cc, ink #5c3b00 / dark bg #3a2a05, ink #ffe3a1): offline / stale tariffs chip.

### Named Rules
**The Independence Rule.** No operator brand colour (MVola, Airtel, Orange) appears as an identifier anywhere. Operators share one neutral badge style.
**The One Board Rule.** Ultramarine belongs to the shell and to selection. Content areas stay enamel and white.

## Typography

**Numeral/Display Font:** Barlow Condensed 600 (self-hosted, Latin subset, 22 KB woff2, SIL OFL), fallback Roboto Condensed / Arial Narrow.
**Body Font:** system UI stack (Roboto on Android).

**Character:** a sign-painter's condensed numeral for amounts and screen titles, against the phone's own sans for reading. Only one weight of the display face ships.

### Hierarchy
- **Display** (600, 2.25rem, 1.05): screen titles.
- **Headline** (600, 1.5rem, 1.15): section titles.
- **Numeral** (600, plate-dependent 1.125 / 1.5 / 2.25rem, tabular): every amount and date on a plate.
- **Lead** (400, 1.1875rem, 1.45, max 34ch): the one-sentence screen intro.
- **Body** (400, 1.0625rem, 1.5, max 65ch).
- **Small** (0.875rem): help, disclaimer, meta.
- **Label** (500/700 active, 0.8125rem): bottom nav labels.

### Named Rules
**The Plate Numerals Rule.** Amounts are always formatted by `formatAr` (non-breaking spaces, « 1 000 000 Ar ») and set in the numeral face with tabular figures; "Ar" is 0.6 em.
**No All-Caps Rule.** Labels are sentence case; nothing is tracked out.

## Layout

Single column, max 560 px, 16 px side gutters, centred above 560 px. Sticky app bar (56 px + safe area), fixed bottom nav (68 px + safe area); `main` reserves the nav height plus 32 px. Spacing scale 4/8/12/16/24/32/48; screens stack with 16 px gaps, sections open with 24 px above. The disclaimer closes every screen after 48 px and a rule. Hash routes: `#/calculer` (default), `#/comparer`, `#/tarifs`, `#/plus`, `#/plus/reglages`, `#/plus/apropos`, `#/plus/favoris`.

## Elevation & Depth

Flat, layered by tone. The board is separated by painted bands (`box-shadow: 0 2px 0 board-deep, 0 4px 0 stripe`), not blur. Plates carry the only soft shadow, `0 1px 2px rgb(16 27 58 / .12)`, enough to read as a raised enamel plate.

## Shapes

Small, sign-like corners: plates 6 px, segments 8 px, panels and buttons 12 px. Borders are 1 px rules; interactive outlines (stepper) are 2 px.

## Components

### Price plate (signature)
White plate, 1 px plate-edge border, numeral face, tabular figures. Sizes s/m/l. Used for the tariff date in the header, the max-transactions value, and (Tasks 12–13) every fee and total.

### Bottom navigation
Four equal columns: Calculer, Comparer, Tarifs, Plus. Icon (24 px, 2 px stroke) above a word, always both. The active item sets its icon on a white plate (56×32) and bolds its label; `aria-current="page"`.

### App bar
Wordmark in the numeral face; right side shows « Tarifs du » + date plate. Offline/stale turns the status into an amber chip with an offline icon. A load failure with no cached tariffs shows an inline alert with a "Réessayer" button on a white plate.

### Board list
One white panel, 1 px rule separators, 64 px rows: icon, title + one-line description, chevron. Used for the Plus menu and source links.

### Segmented control
Native radios inside a panel; selected segment painted ultramarine (dark: light plate). 48 px tall, focus ring on the visible span.

### Stepper
56 px square buttons with a 2 px outline, value on a large plate, disabled at bounds.

### Operator badge
Neutral monogram (MV / AM / OM) in a 36×28 outlined plate + name. Same colour for all operators.

### Amount field (Calculer)
The typed amount is set like a plate numeral (Barlow Condensed 2.25rem, tabular) in a 64 px surface box with a 2 px accent outline and a faded « Ar ». Numeric keypad (`inputmode="numeric"`), spaces accepted, formatted as you type with the caret kept. Below it, four quick-amount plates (10 000 / 50 000 / 100 000 / 500 000); the active one is painted as a selected segment.

### Result card (the hero)
« Meilleure option »: a surface panel with a 2 px accent-line border (the selected answer). Transactions are numbered rows read like a fare board line: amount on a medium plate, a dotted leader, then « frais » and a small fee plate. A rule, then « Frais au total » on a large plate; then the savings in Savings Green with a check icon. Receive and Max modes lead with the amount to send / withdraw on a large plate. Share and Favori sit in two equal outlined buttons at the foot. Alternatives follow as a board list (badge, path, extra cost, total plate).

### Fee staircase
Inline SVG, single series: accent-line 2 px step line with a 10 % wash, hairline grid, condensed tabular ticks. Ink dot + hairline at the amount paid in one go, Savings Green dots at the split transactions (legend for both). The touched tier gets an 8 % band and its range/fee is read out below; a « Voir la grille en tableau » disclosure gives the same tiers as a table.

### Near-tier hint
Surface notice with a bulb icon, shown only when a slightly lower amount still saves ≥ 20 % against the best split; one outlined button applies it.

### Disclaimer
Small faded text above a rule at the end of every screen: « Calcul indicatif basé sur les grilles publiques des opérateurs. Application indépendante, non affiliée à MVola, Airtel ou Orange. »

## Do's and Don'ts

### Do:
- **Do** put every amount on a plate via `formatAr`/`<Plate>`.
- **Do** pair every icon with a word (low-literacy users).
- **Do** keep targets ≥ 48 px and contrast ≥ 4.5:1; test at 360 px in both themes.
- **Do** keep all copy in `src/ui/i18n/{fr,mg}.json`.

### Don't:
- **Don't** use operator logos or brand colours; don't add USSD codes or `tel:` links.
- **Don't** add eyebrows/kickers, gradient text, all-caps labels or decorative blur.
- **Don't** add a second display weight or another web font (budget).
- **Don't** colour content panels with the board blue; it belongs to the shell and selection.
