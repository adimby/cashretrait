---
version: 1
slug: "src-ui-app-tsx"
primary_target: "src/ui/App.tsx"
related_targets: []
---

# Surface: app shell (Calculer · Comparer · Tarifs · Plus)

Mode: Operate. Audience: Malagasy mobile-money users on cheap Android phones, often outdoors at a kiosk. Task: get the cheapest split of an amount and trust it. Constraints: 360 px first, ≥48 px targets, WCAG AA, light + dark, <100 KB JS, no operator colours/logos, mandatory disclaimer.

Decision taken unattended (implementation subagent, no answer channel; degraded roll, no challengers). Grounded list, by resonance: 1 Ariary banknotes, 2 hand-painted kiosk signs, 3 school cahier, 4 lamba hoany border + proverb, 5 zoma cardboard price tags, 6 taxi-brousse station fare boards (assigned), 7 carbon receipt booklet.

## Direction contract

THESIS: CashRetrait reads like the painted fare board at a gare routière: you look up, find your line, read the price. It refuses the fintech default (white cards, gradient balance hero, brand-coloured CTA).

OWN-WORLD: deep coachwork ultramarine board for header and bottom bar, pale cool enamel ground (never cream), white rounded "price plates" carrying bold condensed tabular numerals (Barlow Condensed 600, self-hosted subset) with a small "Ar"; body in the system sans. Thin pinstripe rules between rows. Operators are neutral monogram plates, identical colour.

STORY: the user sees the amount field first, understands the cheapest split on one plate, trusts it because the source date and the independence disclaimer are always visible.

FIRST VIEWPORT: blue board header with wordmark and the tariff date plate; screen title; work area; disclaimer strip above a 4-item blue bottom nav (icon + word, 64 px, active item gets a white plate behind its icon).

FORM: fare board, position 6 of 7; seed:0ea7ca54cadde117. Signature move: the price plate.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
