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
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.1
  headline:
    fontFamily: "Barlow Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.15
  numeral:
    fontFamily: "Barlow Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum, lnum"
  numeral-s:
    fontFamily: "Barlow Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
  numeral-m:
    fontFamily: "Barlow Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1
  numeral-l:
    fontFamily: "Barlow Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  lead:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
  small:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, sans-serif"
    fontSize: "0.8125rem"
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  plate: "6px"
  segment: "8px"
  panel: "12px"
spacing:
  s1: "3px"
  s2: "6px"
  s3: "8px"
  s4: "12px"
  s5: "16px"
  s6: "24px"
  s7: "32px"
  gutter: "16px"
components:
  plate-s:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.plate}"
    padding: "3px 7px"
  plate-l:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.plate-ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.plate}"
    padding: "6px 12px"
  appbar:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    height: "48px"
  navbar:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink-2}"
    height: "60px"
  navbar-item-active:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.board}"
    rounded: "{rounded.plate}"
    size: "48px x 28px"
  segment-selected:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.segment}"
    height: "44px"
  board-list:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  board-row:
    height: "52px"
    padding: "12px 16px"
  button-on-board:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.board}"
    rounded: "{rounded.panel}"
    height: "44px"
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
- Compact but tappable (density pass, user feedback on a 412 px phone): 44 px minimum targets, 52 px rows, 60 px nav, 15 px body.
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
- **Display** (600, 1.625rem, 1.1): screen titles.
- **Headline** (600, 1.25rem, 1.15): section titles.
- **Numeral** (600, plate-dependent 1 / 1.25 / 1.75rem, tabular): every amount and date on a plate.
- **Lead** (400, 1.0625rem, 1.45, max 34ch): the one-sentence screen intro.
- **Body** (400, 0.9375rem, 1.45, max 65ch).
- **Small** (0.8125rem): help, disclaimer, meta.
- **Label** (500/700 active, 0.75rem): bottom nav labels.

### Named Rules
**The Plate Numerals Rule.** Amounts are always formatted by `formatAr` (non-breaking spaces, « 1 000 000 Ar ») and set in the numeral face with tabular figures; "Ar" is 0.6 em.
**No All-Caps Rule.** Labels are sentence case; nothing is tracked out.

## Layout

Single column, max 560 px, 16 px side gutters (`--gutter`), centred above 560 px. Sticky app bar (48 px + safe area), fixed bottom nav (60 px + safe area); `main` reserves the nav height plus 24 px. Spacing scale 3/6/8/12/16/24/32 (compact, about a third tighter than the first build); screens stack with 12 px gaps, sections open with 16 px above. The disclaimer closes every screen after 32 px and a rule. Goal: on a 412 px phone the answer (result card) starts in the first viewport. Hash routes: `#/calculer` (default), `#/comparer`, `#/tarifs`, `#/plus`, `#/plus/reglages`, `#/plus/apropos`, `#/plus/favoris`.

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
One white panel, 1 px rule separators, 52 px rows: icon, title + one-line description, chevron. Used for the Plus menu and source links.

### Segmented control
Native radios inside a panel; selected segment painted ultramarine (dark: light plate). 44 px tall, focus ring on the visible span.

### Calculer form (compact)
Modes are one line of underlined tabs (Retirer · Envoyer · Faire recevoir · Vider): no panel, 44 px, the selected tab in ink with a 3 px accent-line underline, a one-line description of the mode below. Operators are three separate outlined pills (monogram + short name: MVola, Airtel, Orange), the selected one painted as a selected segment; no surrounding panel. « Retrait sans compte (avec un code) » is a checkbox, not a two-option segment. Quick amounts are 34 px plates (hit area 44 px) shown only while the amount is empty; a ✕ inside the amount box clears it and brings them back. Operators in the single picker are name-only pills (no monogram). The screen title « Calculer », the mode description and the « Opérateur » legend are visually hidden (kept for screen readers); the amount label sits inside the amount box, above the numeral. The result card shows « Total retiré » (or « Total envoyé ») next to « Frais au total », both on medium plates.

### Stepper
48 px square buttons (44 px in the compact variant) with a 2 px outline, value on a large plate, disabled at bounds.

### Operator badge
Neutral monogram (MV / AM / OM) in a 32×24 outlined plate + name. Same colour for all operators. In the operator picker the monogram sits beside the name (one 44 px row, names may wrap on two lines); with a fourth option (« Sans compte », « N'importe lequel ») it stacks above the name.

### Amount field (Calculer)
The typed amount is set like a plate numeral (Barlow Condensed 1.875rem, tabular) in a 52 px surface box with a 2 px accent outline and a faded « Ar ». Numeric keypad (`inputmode="numeric"`), spaces accepted, formatted as you type with the caret kept. Below it, four quick-amount plates (10 000 / 50 000 / 100 000 / 500 000); the active one is painted as a selected segment.

### Result card (the hero)
« Meilleure option »: a surface panel with a 2 px accent-line border (the selected answer). Transactions are numbered rows read like a fare board line: amount on a medium plate, a dotted leader, then « frais » and a small fee plate. A rule, then « Frais au total » on a large plate; then the savings in Savings Green with a check icon. Receive and Max modes lead with the amount to send / withdraw on a large plate. Share and Favori sit in two equal outlined buttons at the foot. Alternatives follow as a board list (badge, path, extra cost, total plate).

### Same budget card (Retirer only)
« Même budget, plus d'argent »: under the result card when splitting gives strictly more cash for the debit of the classic one-go withdrawal. A surface panel (1 px rule, not the accent border: it supports, the result card leads). One sentence of intro, then a real table: row headers Retiré / Frais / Débité, columns « 1 seul retrait » and « En n retraits »; every value on a small plate, the better column washed with 8 % Savings Green and green plate edges, its « Retiré » plate one step larger. Below: the extra cash in Savings Green with a check (same pattern as the savings line), then the split and what stays on the account in small faded text.

### Fee staircase
Inline SVG, single series: accent-line 2 px step line with a 10 % wash, hairline grid, condensed tabular ticks. Ink dot + hairline at the amount paid in one go, Savings Green dots at the split transactions (legend for both). The touched tier gets an 8 % band and its range/fee is read out below; a « Voir la grille en tableau » disclosure gives the same tiers as a table.

### Near-tier hint
Surface notice with a bulb icon, shown only when a slightly lower amount still saves ≥ 20 % against the best split; one outlined button applies it.

### Update banner
Top of Calculer and Tarifs when fees changed since the tariffs last acknowledged (`cr.lastSeen`; a first visit just records them). Surface panel with a 2 px accent-line border, refresh icon in an outlined plate-sized square, headline « Tarifs mis à jour », the first 5 changes as ruled lines (numbers never wrap), « Voir tout (n) » outlined and « OK, compris » solid (selected colours). `role="status"`.

### Monthly ranking (Comparer)
Usage cards (operation segments on a ground-tinted track, amount field without quick plates, compact 48 px stepper) feed a board list ranked cheapest first: badge + total on a medium plate, then a single-hue 8 px magnitude bar anchored at zero (accent-line; Savings Green with « Le moins cher » and a check for the cheapest), then the extra cost per month. Unavailable operators read « non disponible ».

### Tariff table (Tarifs)
Operator picker, operation segments (2 columns, « non disponible » under absent ones), publication date on a small plate, then a full-width table: ranges in condensed tabular numerals, fee on a small plate per line. An absent operation shows a dashed panel with a « non disponible » plate. History: dated groups of board rows, old fee (faded plate) › new fee; empty history is a calm note, never an error.

### Favorites list
Board rows that open the calculation in Calculer, each with a 72 px « Supprimer » column (icon above word). Deleting shows an inline status with « Annuler ».

### Disclaimer
Small faded text above a rule at the end of every screen: « Calcul indicatif basé sur les grilles publiques des opérateurs. Application indépendante, non affiliée à MVola, Airtel ou Orange. »

## Do's and Don'ts

### Do:
- **Do** put every amount on a plate via `formatAr`/`<Plate>`.
- **Do** pair every icon with a word (low-literacy users).
- **Do** keep targets ≥ 44 px and contrast ≥ 4.5:1; test at 360 px and 412 px in both themes.
- **Do** keep all copy in `src/ui/i18n/{fr,mg}.json`.

### Don't:
- **Don't** use operator logos or brand colours; don't add USSD codes or `tel:` links.
- **Don't** add eyebrows/kickers, gradient text, all-caps labels or decorative blur.
- **Don't** add a second display weight or another web font (budget).
- **Don't** colour content panels with the board blue; it belongs to the shell and selection.
