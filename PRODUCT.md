# Product

<!-- impeccable:product-schema 1 -->

> Inferred from the project brief and spec (docs/superpowers/specs/2026-11-02-cashretrait-design.md); no live interview was possible (implementation subagent). Facts marked *(inferred)* need confirmation.

## Platform

web

## Users
General public in Madagascar who use mobile money (MVola, Airtel Money, Orange Money) to withdraw cash at a kiosk or send money to family. Mostly on low/mid-range Android phones, often on 3G or flaky networks, many with limited literacy in French; some prefer Malagasy. They open the app standing at or on the way to a mobile-money kiosk, with an amount in mind, wanting to know how to split it so they pay the least.

## Product Purpose
CashRetrait computes the cheapest way to withdraw or transfer money (optimal split into several transactions, inverse calculation, max withdrawable, operator comparison). Success: the user trusts the figure, understands it at a glance, and saves fees.

## Positioning
Independent and free: it reads the operators' public fee grids and proves the split is optimal. It is not affiliated with any operator and must never look like an operator app or a bank.

## Operating Context
Used one-handed outdoors or in a kiosk queue, in bright daylight or at night; offline after the first visit (PWA). Amounts in Ariary, formatted « 1 000 000 Ar ».

## Capabilities and Constraints
- Indicative only: no USSD codes, no tel: links, never performs an operation.
- JS budget < 100 KB gzip; no CSS framework; system fonts or one small self-hosted font.
- FR and MG interface (MG to be reviewed by a native speaker).
- Tariffs from `public/tarifs.json`, updated daily by automation.

## Brand Commitments
- Name: CashRetrait.
- Operator identity shown only with neutral badges; never operator logos or brand colors (yellow/red/orange) used to identify them.
- Mandatory disclaimer: « Calcul indicatif basé sur les grilles publiques des opérateurs. Application indépendante, non affiliée à MVola, Airtel ou Orange. »
- Tone: trustworthy, clear, local; not a bank clone, not flashy.

## Evidence on Hand
Real public fee grids in `public/tarifs.json`. No testimonials, user counts or partnerships exist; never invent them.

## Product Principles
1. The number is the product: amounts and fees must be readable before anything else.
2. Plain words over finance jargon, in the user's language.
3. Light enough for 3G and cheap phones; works offline.
4. Independence is visible: neutral toward all three operators.

## Accessibility & Inclusion
WCAG AA contrast, touch targets ≥ 48 px, 360 px first, large type, icons paired with words for low-literacy users *(inferred)*.
