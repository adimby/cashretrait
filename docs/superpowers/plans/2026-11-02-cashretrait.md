# CashRetrait Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA statique (FR/MG) qui calcule le découpage le moins cher des retraits et transferts MVola / Airtel / Orange, avec tarifs versionnés dans `public/tarifs.json`, mis à jour par GitHub Action quotidienne et par une page admin `/zadmin`.

**Architecture:** Moteur TypeScript pur (`src/engine`) exécuté dans le navigateur, hors-ligne via service worker. Schéma Zod et parsers partagés (`src/tariffs`) entre l'app, le script `scripts/update-tariffs.ts` (GitHub Actions) et les fonctions Vercel `api/*` utilisées uniquement par l'admin. Git sert de base de données.

**Tech Stack:** Node 20, Vite 5, Preact 10, TypeScript 5 (strict), vite-plugin-pwa, Zod 3, cheerio, pdfjs-dist, Vitest, Playwright (déjà installé dans l'environnement — ne pas lancer `playwright install`), tsx, @vercel/node.

**Spec:** `docs/superpowers/specs/2026-11-02-cashretrait-design.md` (lire en entier avant toute tâche).

## Global Constraints

- Aucune base de données ; `public/tarifs.json` est la seule source de vérité des tarifs.
- Aucun code USSD, aucun lien `tel:`, aucune exécution d'opération pour l'utilisateur.
- Montants : entiers en Ariary, bornes de palier incluses ; format d'affichage `1 000 000 Ar` (espace insécable fine U+202F ou espace normal, via `Intl.NumberFormat('fr-FR')`).
- Case vide / hors palier = opération **non disponible** (`null`), jamais 0. Gratuit explicite = `fee: 0`.
- Réglages par défaut : pas d'arrondi 1 000 (choix 100 / 1 000 / 5 000), max transactions 5 (choix 1–10).
- Bundle JS public < 100 Ko gzip, hors chunk admin.
- Langues : `fr` (défaut) et `mg` ; aucune chaîne UI en dur hors fichiers i18n.
- Admin : route `/zadmin` ; `/admin` → 404 standard ; `X-Robots-Tag: noindex, nofollow` sur `/zadmin` et `/api/*` ; `/zadmin` absent de `robots.txt`, du sitemap et de tout lien.
- Mention obligatoire sous chaque résultat et dans À propos : « Calcul indicatif basé sur les grilles publiques des opérateurs. Application indépendante, non affiliée à MVola, Airtel ou Orange. »
- Le moteur ne lève jamais d'exception sur une saisie utilisateur : il retourne `{ ok: false, reason }`.
- Commits : messages conventionnels, se terminant par les lignes d'attribution de la session.

## Review Focus

1. Montant non multiple du pas (ex. 25 550 Ar avec pas 1 000) → le découpage reste exact au montant saisi ; seule une transaction porte l'appoint. Test dans Task 3.
2. Montant au-dessus de `maxTx` × plafond (ex. 120 000 000 Ar MVola, max 5 tx) → `{ ok:false, reason:'too_large' }`, pas de boucle infinie ni de résultat partiel. Test dans Task 3.
3. Solde inférieur au minimum + frais (ex. 150 Ar) pour « max retirable » → `{ ok:false, reason:'insufficient' }`. Test dans Task 4.
4. Parser face à une page dont le tableau a changé de colonnes → erreur explicite `ParseError`, jamais un JSON partiellement vide accepté. Test dans Task 7.
5. Service worker avec un `tarifs.json` en cache plus ancien que le schéma courant (`schemaVersion` différent) → l'app ignore le cache et refetch ; hors-ligne, affiche l'ancienne version avec avertissement. Test dans Task 12 (unitaire sur `loadTariffs`).

---

## Fichiers

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, playwright.config.ts, vercel.json, index.html, zadmin.html
public/tarifs.json, public/robots.txt, public/icons/*
src/engine/types.ts        types partagés du moteur
src/engine/fees.ts         feeFor
src/engine/optimize.ts     optimizeSplit
src/engine/inverse.ts      inverse, maxWithdrawable
src/engine/paths.ts        sendPaths
src/engine/hints.ts        tierHint
src/engine/monthly.ts      monthlyCost
src/tariffs/schema.ts      Zod + types Tariffs
src/tariffs/validate.ts    validateTariffs, diffTariffs
src/tariffs/parsers/{common,airtel,mvola,orange,generic}.ts
src/ui/...                 app Preact (détaillé Tasks 11–13)
src/admin/...              app /zadmin (Task 15)
api/login.ts, api/parse.ts, api/commit.ts, api/_lib/{session,github}.ts
scripts/update-tariffs.ts, scripts/build-history.ts
.github/workflows/update-tariffs.yml, .github/workflows/ci.yml
tests/fixtures/{airtel.html,mvola.html,orange.pdf}
tests/** (miroir de src/)
e2e/*.spec.ts
```

---

### Task 1: Scaffold, schéma des tarifs et tarifs initiaux

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.tsx` (rend « CashRetrait »), `src/tariffs/schema.ts`, `public/tarifs.json`, `.github/workflows/ci.yml`
- Test: `tests/tariffs/schema.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const OPERATORS = ['mvola','airtel','orange'] as const
  export type OperatorId = typeof OPERATORS[number]
  export const OPERATIONS = ['withdrawal','withdrawal_non_customer','transfer_same','transfer_same_app','transfer_other_op','transfer_non_customer'] as const
  export type OperationKey = typeof OPERATIONS[number]
  export type Tier = { min: number; max: number } & ({ fee: number } | { feePercent: number })
  export type FeeTable = Tier[]
  export type Operator = { name: string; source: { url: string; type: 'html'|'pdf'; publishedAt: string|null };
    limits: { minTx: number; maxTx: number; maxBalance: number }; fees: Partial<Record<OperationKey, FeeTable>> }
  export type Tariffs = { schemaVersion: 1; updatedAt: string; operators: Record<OperatorId, Operator> }
  export const TariffsSchema: z.ZodType<Tariffs>
  export const SCHEMA_VERSION = 1
  ```

- [ ] **Step 1:** `npm init`, installer dépendances listées dans Tech Stack ; scripts `dev`, `build` (`tsc --noEmit && vite build`), `test` (`vitest run`), `e2e` (`playwright test`), `update-tariffs` (`tsx scripts/update-tariffs.ts`). CI : `npm ci && npm test && npm run build` sur push/PR.
- [ ] **Step 2: Test qui échoue** — `tests/tariffs/schema.test.ts` :
  - `public/tarifs.json` passe `TariffsSchema.parse`.
  - rejette un palier `{min:1000,max:100,fee:5}` (min > max).
  - rejette un palier avec `fee` négatif et un palier sans `fee` ni `feePercent`.
  - valeurs de contrôle : `mvola.fees.withdrawal` contient `{min:1000001,max:2000000,fee:14700}` ; `airtel.fees.transfer_same` contient `{min:1001,max:5000,fee:65}` ; `orange.fees.withdrawal[0]` vaut `{min:200,max:1000,fee:100}` ; `orange.fees.transfer_non_customer` (IzyCash) contient `{min:9000001,max:10000000,fee:58000}`.
- [ ] **Step 3:** Écrire `schema.ts` puis remplir `public/tarifs.json` à la main à partir des grilles officielles, en suivant ce mapping (les valeurs exactes sont dans les sources ; la spec §6.1 donne les URLs ; Orange : `tests/fixtures/orange.pdf`, `pdftotext -layout`) :
  | Opérateur | Clé | Colonne source |
  |---|---|---|
  | mvola | withdrawal | « Auprès d'un Cash Point MVola » (100 → 20 000 000) |
  | mvola | withdrawal_non_customer | « Retrait par un non abonné MVola : GRATUIT » → un palier `fee:0` couvrant 100–5 000 000 |
  | mvola | transfer_same | « Vers un abonné MVola » |
  | mvola | transfer_other_op | « Vers ou depuis … Autres Opérateurs » (min 300, jusqu'à 5 000 000) |
  | mvola | transfer_non_customer | « Vers un non abonné Mobile Money » |
  | airtel | withdrawal | « Retrait - Abonnés ayant un compte » |
  | airtel | withdrawal_non_customer | « Retrait - n'ayant pas de compte » (commence à 5 001) |
  | airtel | transfer_same | « transfert vers les abonnés » |
  | airtel | transfer_other_op | « vers les autres opérateurs » (jusqu'à 5 000 000) |
  | orange | withdrawal | « Fisintonam-bola » (min 200) |
  | orange | transfer_same | « Mankany @ Orange Money #144# » |
  | orange | transfer_same_app | « @ Appli -50% » |
  | orange | transfer_other_op | « Mankany @ tambazotra hafa » (jusqu'à 5 000 000) |
  | orange | transfer_non_customer | « IzyCash » |
  Limites : mvola `{100, 20000000, 20000000}`, airtel `{100, 20000000, 20000000}`, orange `{200, 20000000, 20000000}`. `publishedAt` : mvola `2025-02-17`, orange `2025-02-01`, airtel `null`. Colonne microfinances Orange : ignorée (hors périmètre).
- [ ] **Step 4:** `npm test` → PASS ; `npm run build` → OK.
- [ ] **Step 5:** Commit `chore: scaffold Vite/Preact + schéma et tarifs initiaux`.

---

### Task 2: `feeFor`

**Files:** Create `src/engine/types.ts`, `src/engine/fees.ts` · Test `tests/engine/fees.test.ts`

**Interfaces:**
- Consumes: `FeeTable`, `Tier` (Task 1)
- Produces:
  ```ts
  // types.ts
  export type Tx = { amount: number; fee: number }
  export type Fail = { ok: false; reason: 'invalid_amount'|'below_min'|'too_large'|'unavailable'|'insufficient' }
  export type SplitOk = { ok: true; transactions: Tx[]; total: number; single: number|null; savings: number }
  export type SplitResult = SplitOk | Fail
  export type SplitOpts = { step: number; maxTx: number; minTx: number; maxTxAmount: number }
  // fees.ts
  export function feeFor(table: FeeTable, amount: number): number | null  // feePercent → Math.ceil(amount*p/100)
  ```

- [ ] **Step 1: Tests** — table MVola retrait : `feeFor(t,1000)=100`, `feeFor(t,1001)=150`, `feeFor(t,99)=null`, `feeFor(t,20000001)=null` ; table `[{min:1,max:100,feePercent:1}]` : `feeFor(t,50)=1` (ceil 0,5) ; table vide → `null`.
- [ ] **Step 2:** Run `npx vitest run tests/engine/fees.test.ts` → FAIL.
- [ ] **Step 3:** Implémenter (recherche linéaire ou dichotomique sur paliers triés).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(engine): feeFor`.

---

### Task 3: `optimizeSplit`

**Files:** Create `src/engine/optimize.ts` · Test `tests/engine/optimize.test.ts`, `tests/engine/bruteforce.ts`

**Interfaces:**
- Consumes: `feeFor`, types (Task 2)
- Produces: `export function optimizeSplit(table: FeeTable, amount: number, opts: SplitOpts): SplitResult`
  - `single` = `feeFor(table, amount)` (null si une seule tx impossible) ; `savings = single===null ? 0 : single - total`.
  - Transactions triées par montant décroissant.

Algorithme (spec §5.1) :
```
candidates = unique( floor(min(tier.max, maxTxAmount)/step)*step ) pour chaque palier, ≥ minTx, feeFor≠null
best = null
pour k de 1 à maxTx :
  si k*maxTxAmount < amount : continuer
  si best && best.k < k && borne_inf(k) ≥ best.total : arrêter   // borne_inf = k * frais minimal de la table
  énumérer multisets de k-1 candidats (ordre non croissant, élagage si somme ≥ amount ou coût partiel ≥ best.total)
    reste = amount - somme ; f = feeFor(table, reste) ; si reste < minTx ou reste > maxTxAmount ou f==null : rejeter
    total = coûtPartiel + f ; garder si total < best.total, ou égal et k plus petit
```
Si `amount` n'est pas entier ou ≤ 0 → `invalid_amount` ; `< minTx` → `below_min` ; `> maxTx*maxTxAmount` → `too_large` ; aucune solution → `unavailable`.

- [ ] **Step 1: Tests** (table MVola retrait de `public/tarifs.json`, `opts={step:1000,maxTx:5,minTx:100,maxTxAmount:20000000}` sauf mention) :
  - `optimizeSplit(t,1000001)` → total `8900`, transactions `[{1000000,8800},{1,100}]`, `single 14700`, `savings 5800` (avec `step:1`, puisque le reste vaut 1).
  - Avec `step:1000`, `optimizeSplit(t,1000001)` → le reste 1 porte l'appoint : total `8900` (Review Focus 1).
  - `optimizeSplit(t,25550, step 1000)` → somme des montants = 25 550 exactement.
  - `optimizeSplit(t,120000000)` → `{ok:false,reason:'too_large'}` (Review Focus 2).
  - `optimizeSplit(t,50)` → `below_min` ; `optimizeSplit(t,1.5)` → `invalid_amount` ; `optimizeSplit([],1000)` → `unavailable`.
  - `maxTx:1` → une seule transaction, `savings 0`.
  - Égalité de coût → moins de transactions : `optimizeSplit(t,50000)` → 1 transaction (1 300) et non 2×25 000 (1 300).
  - **Force brute** : `bruteforce.ts` énumère toutes les partitions en multiples de `step` (step 1 000, maxTx 4) pour chaque montant de 1 000 à 120 000 par pas de 1 000, sur les tables `withdrawal` et `transfer_same` des 3 opérateurs, plus une table synthétique avec `feePercent` ; assertion `optimizeSplit.total === bruteforce.total` pour tous.
  - Performance : `optimizeSplit(t, 19999000, {step:1000,maxTx:5,...})` termine en < 200 ms dans Vitest.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implémenter. Pour les paliers `feePercent`, ajouter aux candidats chaque multiple de `step` du palier concerné uniquement si la table contient < 50 tels multiples ; sinon les bornes min et max du palier.
- [ ] **Step 4:** → PASS (y compris force brute et perf).
- [ ] **Step 5:** Commit `feat(engine): découpage optimal`.

---

### Task 4: `inverse` et `maxWithdrawable`

**Files:** Create `src/engine/inverse.ts` · Test `tests/engine/inverse.test.ts`

**Interfaces:**
- Consumes: `optimizeSplit`, types, `Tariffs`
- Produces:
  ```ts
  export type InverseInput = { net: number; withdrawTable: FeeTable; transferTable: FeeTable; includeWithdrawalFee: boolean; opts: SplitOpts }
  export type InverseResult = { ok: true; send: number; transfer: SplitOk; withdrawal: SplitOk; total: number } | Fail
  export function inverse(i: InverseInput): InverseResult
  export type MaxResult = { ok: true; amount: number; withdrawal: SplitOk; remaining: number } | Fail
  export function maxWithdrawable(table: FeeTable, balance: number, opts: SplitOpts): MaxResult
  ```

- [ ] **Step 1: Tests** :
  - MVola→MVola, `net 100000`, frais compris : retrait optimal de 100 000 = 1 900 → `send 101900` ; transfert de 101 900 = 1 900 → `total 3800`.
  - Même chose sans frais compris → `send 100000`, `total = transfer(100000).total + 1900`.
  - Si le retrait est indisponible → propage `unavailable`.
  - `maxWithdrawable(mvolaRetrait, 487350, step 1000)` → `amount + withdrawal.total ≤ 487350` et `amount + 1000` (montant suivant) ne tient plus ; vérifier contre une recherche linéaire par pas de 1 000.
  - `maxWithdrawable(t, 150, step 100)` → `insufficient` (Review Focus 3).
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implémenter. `maxWithdrawable` : dichotomie sur M ∈ [minTx, balance] (multiples de step), puis tester aussi chaque `tier.max` arrondi ≤ borne trouvée + 1 palier, garder le plus grand M valide.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(engine): calcul inverse et max retirable`.

---

### Task 5: Chemins, alerte palier, coût mensuel

**Files:** Create `src/engine/paths.ts`, `src/engine/hints.ts`, `src/engine/monthly.ts` · Tests `tests/engine/{paths,hints,monthly}.test.ts`

**Interfaces:**
- Consumes: `optimizeSplit`, `inverse`, `Tariffs`, `OperatorId`, `OperationKey`
- Produces:
  ```ts
  export type PathKind = 'same'|'same_app'|'other_op'|'non_customer'
  export type SendPath = { kind: PathKind; from: OperatorId; to: OperatorId|null; result: InverseResult }
  export function sendPaths(t: Tariffs, from: OperatorId, to: OperatorId|null, net: number, includeWithdrawalFee: boolean, opts: Omit<SplitOpts,'minTx'|'maxTxAmount'>): SendPath[]
  // triés par total croissant, chemins !ok exclus

  export type Hint = { amount: number; fee: number; currentFee: number }
  export function tierHint(table: FeeTable, amount: number, step: number): Hint | null

  export type Usage = { operation: 'withdrawal'|'transfer_same'|'transfer_other_op'; amount: number; perMonth: number }
  export function monthlyCost(t: Tariffs, usages: Usage[], opts: Omit<SplitOpts,'minTx'|'maxTxAmount'>): { operator: OperatorId; total: number|null }[]
  // trié croissant, null en dernier (opération indisponible)
  ```
  Règles `sendPaths` : `same` (from=to, `transfer_same` + `withdrawal` de from) ; `same_app` si `transfer_same_app` existe ; `other_op` (to≠from, `transfer_other_op` de from + `withdrawal` de to) ; `non_customer` (`transfer_non_customer` de from + `withdrawal_non_customer` de from, `to` = null). Si `to` = null : tous les `to` possibles. `minTx`/`maxTxAmount` viennent des `limits` de l'opérateur concerné.
  Règle `tierHint` : plus grand plafond de palier `c` (arrondi à `step`) avec `amount - c ≤ max(2% de amount, step)` et `c < amount`, si `feeFor(c) ≤ 0,8 × feeFor(amount)`.

- [ ] **Step 1: Tests** :
  - `tierHint(mvolaRetrait, 25500, 500)` → `{amount:25000, fee:650, currentFee:1300}` ; `tierHint(mvolaRetrait, 30000, 1000)` → `null`.
  - `sendPaths(t,'mvola','airtel',100000,true,…)` contient un chemin `other_op` dont `total` = transfert MVola autres op. de (100 000 + retrait Airtel 100 000 = 1 900) + 1 900 ; liste triée.
  - `sendPaths(t,'orange','orange',…)` contient `same` et `same_app`, `same_app` moins cher.
  - `monthlyCost` avec `[{operation:'withdrawal',amount:200000,perMonth:4}]` → 3 entrées, chaque `total = 4 × optimizeSplit(...).total`, trié.
- [ ] **Step 2:** → FAIL. **Step 3:** Implémenter. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(engine): chemins, alerte palier, coût mensuel`.

---

### Task 6: Validation et diff des tarifs

**Files:** Create `src/tariffs/validate.ts` · Test `tests/tariffs/validate.test.ts`

**Interfaces:**
- Consumes: `Tariffs`, `TariffsSchema`
- Produces:
  ```ts
  export type Validation = { status: 'ok'|'suspect'|'invalid'; reasons: string[] }
  export function validateTariffs(next: unknown, prev: Tariffs|null): Validation
  export type FeeChange = { operator: OperatorId; operation: OperationKey; min: number; max: number; before: number|null; after: number|null }
  export function diffTariffs(prev: Tariffs, next: Tariffs): FeeChange[]
  export function formatChange(c: FeeChange, lang: 'fr'|'mg'): string  // fr : « MVola retrait 25 001–50 000 : 1 300 → 1 500 »
  export function mergeOperator(prev: Tariffs, id: OperatorId, op: Operator): Tariffs
  ```
  Règles (spec §4) : invalid = échec Zod, paliers non triés / non contigus / chevauchants, bornes hors `limits` ; suspect = frais décroissant, opérateur ou opération disparu, variation > 50 % d'un frais existant.

- [ ] **Step 1: Tests** : tarifs actuels vs eux-mêmes → `ok`, diff `[]` ; trou entre paliers → `invalid` ; frais ×2 → `suspect` + raison mentionnant opérateur et palier ; suppression de `airtel.fees.withdrawal` → `suspect` ; `formatChange` produit exactement la chaîne fr ci-dessus ; `mergeOperator` ne touche que l'opérateur donné et met à jour `updatedAt`.
- [ ] **Step 2–4:** FAIL → implémenter → PASS.
- [ ] **Step 5:** Commit `feat(tariffs): validation et diff`.

---

### Task 7: Parsers HTML Airtel et MVola

**Files:** Create `src/tariffs/parsers/common.ts`, `airtel.ts`, `mvola.ts`, `generic.ts`; fixtures `tests/fixtures/airtel.html`, `tests/fixtures/mvola.html` · Test `tests/tariffs/parsers.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export class ParseError extends Error {}
  export function parseAmount(s: string): number | null      // « 1 000 », « 1 000 Ar », « Gratuit »→0, « – », « - », « »→null
  export function rowsToTable(rows: { min: number; max: number; cell: string }[]): FeeTable  // ignore cellules null
  export function parseAirtel(html: string): Operator
  export function parseMvola(html: string): Operator           // publishedAt depuis « au JJ-MM-AAAA »
  export function parseGenericTables(htmlOrText: string): { headers: string[]; rows: string[][] }[]
  ```
  Repérage des colonnes **par libellé d'en-tête** (sous-chaînes normalisées sans accents, ex. « retrait » + « ayant un compte »), jamais par index. Colonne attendue absente → `ParseError` (Review Focus 4). Bornes MVola extraites de « Entre X et Y Ar ».

- [ ] **Step 1:** Enregistrer les fixtures : `curl -sL https://www.airtel.mg/airtelmoney/transaction_fees > tests/fixtures/airtel.html` et idem MVola (si le proxy bloque, les produire depuis un poste ou depuis le premier run du workflow Task 9 et les committer).
- [ ] **Step 2: Tests** : `parseAirtel(fixture).fees` deep-equal aux tables airtel de `public/tarifs.json` ; idem `parseMvola` + `publishedAt === '2025-02-17'` ; `parseAmount('1 000')=1000`, `('Gratuit')=0`, `('–')=null` ; fixture Airtel dont l'en-tête « vers les abonnés » est renommé → `ParseError`.
- [ ] **Step 3–4:** FAIL → implémenter (cheerio) → PASS.
- [ ] **Step 5:** Commit `feat(tariffs): parsers Airtel et MVola`.

---

### Task 8: Parser PDF Orange

**Files:** Create `src/tariffs/parsers/orange.ts` · Test `tests/tariffs/orange.test.ts` (fixture `tests/fixtures/orange.pdf`, déjà présente)

**Interfaces:**
- Produces: `export async function parseOrange(pdf: Uint8Array): Promise<Operator>`

Approche : `pdfjs-dist/legacy` → items texte avec coordonnées ; regrouper par ligne (y arrondi) ; une ligne de palier commence par deux montants (min, max) puis 6 valeurs dans l'ordre retrait, #144#, appli, autres réseaux, microfinances, IzyCash ; « - » → null. Ignorer le bloc « Mpiara miasa » (colonne de droite, x au-delà de la colonne IzyCash). `publishedAt` depuis « manomboka ny 01 Febroary 2025 » (mois malgaches : Janoary, Febroary, Martsa, Aprily, Mey, Jona, Jolay, Aogositra, Septambra, Oktobra, Novambra, Desambra). Moins de 15 lignes de paliers trouvées → `ParseError`.

- [ ] **Step 1: Tests** : `parseOrange(fixture).fees` deep-equal aux tables orange de `public/tarifs.json` ; `publishedAt === '2025-02-01'` ; PDF tronqué (premiers 10 Ko) → rejette avec `ParseError`.
- [ ] **Step 2–4:** FAIL → implémenter → PASS.
- [ ] **Step 5:** Commit `feat(tariffs): parser PDF Orange`.

---

### Task 9: Script de mise à jour et workflow GitHub

**Files:** Create `scripts/update-tariffs.ts`, `.github/workflows/update-tariffs.yml` · Test `tests/scripts/update-tariffs.test.ts`

**Interfaces:**
- Consumes: parsers (7, 8), `validateTariffs`, `diffTariffs`, `formatChange`, `mergeOperator`
- Produces:
  ```ts
  export type Fetcher = (url: string) => Promise<Uint8Array>
  export type UpdateOutcome = { operator: OperatorId; status: 'unchanged'|'ok'|'suspect'|'failed'; changes: FeeChange[]; reasons: string[] }
  export async function runUpdate(current: Tariffs, fetcher: Fetcher): Promise<{ next: Tariffs; outcomes: UpdateOutcome[] }>
  ```
  `main()` (si exécuté directement) : lit `public/tarifs.json`, exécute `runUpdate`, puis écrit
  - `public/tarifs.json` avec uniquement les opérateurs `ok` fusionnés ;
  - `update-report.json` (outcomes) et `update-summary.md` (changements formatés fr, raisons).

Workflow : `schedule: cron '0 3 * * *'` + `workflow_dispatch` ; permissions `contents: write, pull-requests: write, issues: write` ; étapes : checkout, setup-node 20, `npm ci`, `npm run update-tariffs`, puis via `actions/github-script` :
  - au moins un `ok` → `npm test` puis commit `chore(tarifs): mise à jour automatique` sur `main` ;
  - un `suspect` → générer les tarifs suspects sur la branche `tarifs/auto-YYYYMMDD`, ouvrir une PR avec `update-summary.md` ;
  - un `failed` → Issue titrée `Mise à jour tarifs échouée : <opérateur>` si aucune Issue ouverte de même titre.

- [ ] **Step 1: Tests** (fetcher simulé servant les fixtures) : fixtures inchangées → tous `unchanged` ; fixture MVola avec un frais modifié de 1 300 à 1 400 → MVola `ok`, `changes.length === 1`, autres `unchanged` ; frais ×3 → `suspect` et `next` garde l'ancien MVola ; fetcher qui lève pour Orange → Orange `failed`, Airtel et MVola traités normalement.
- [ ] **Step 2–4:** FAIL → implémenter → PASS.
- [ ] **Step 5:** Commit `feat: mise à jour automatique des tarifs (script + workflow)`.
- [ ] **Step 6 (manuel, après merge sur main) :** lancer le workflow via `workflow_dispatch`, vérifier que le PDF Orange se télécharge depuis GitHub Actions ; sinon noter dans le README « Orange : import manuel via /zadmin » et faire passer Orange en `failed` sans Issue répétée (Issue unique déjà dédupliquée).

---

### Task 10: Historique des tarifs

**Files:** Create `scripts/build-history.ts` · Test `tests/scripts/build-history.test.ts` · Modify `package.json` (`build`: `tsx scripts/build-history.ts && tsc --noEmit && vite build`)

**Interfaces:**
- Produces:
  ```ts
  export type HistoryEntry = { date: string; changes: FeeChange[] }
  export function buildHistory(versions: { date: string; tariffs: Tariffs }[]): HistoryEntry[]   // ordre chronologique, entrées sans changement omises
  ```
  `main()` : `git log --format=%H%x09%cI -- public/tarifs.json`, `git show <sha>:public/tarifs.json` pour chacun (versions invalides au schéma ignorées), écrit `public/tarifs-history.json`. Si l'historique Git est indisponible (clone superficiel), écrit `[]` sans échouer.

- [ ] **Step 1: Tests** : 3 versions dont la 2ᵉ identique à la 1ʳᵉ → 1 entrée ; versions dans le désordre → résultat chronologique.
- [ ] **Step 2–4:** FAIL → implémenter → PASS.
- [ ] **Step 5:** Commit `feat: historique des tarifs généré au build`.

---

### Task 11: Coquille UI, i18n, réglages, PWA

Avant cette tâche : invoquer le skill `frontend-design` pour la direction visuelle (mobile d'abord, grands boutons, contraste élevé).

**Files:** Create `src/ui/App.tsx`, `src/ui/i18n/{index.ts,fr.json,mg.json}`, `src/ui/state/settings.ts`, `src/ui/state/tariffs.ts`, `src/ui/format.ts`, `src/ui/components/{NavBar,Disclaimer}.tsx`, `src/ui/screens/{Settings,About}.tsx`; Modify `vite.config.ts` (vite-plugin-pwa), `index.html`; `public/icons/*`, `public/robots.txt` (`User-agent: *` / `Allow: /`) · Tests `tests/ui/{i18n,format,settings,tariffs}.test.ts`

**Interfaces:**
- Consumes: `Tariffs`, `TariffsSchema`, `SCHEMA_VERSION`
- Produces:
  ```ts
  export type Lang = 'fr'|'mg'
  export function t(key: string, vars?: Record<string, string|number>): string; export const lang: Signal<Lang>
  export function formatAr(n: number): string   // 1000000 → '1 000 000 Ar'
  export type Settings = { lang: Lang; step: 100|1000|5000; maxTx: number }
  export const settings: Signal<Settings>        // persistance localStorage 'cr.settings', try/catch
  export async function loadTariffs(fetchImpl?: typeof fetch): Promise<{ tariffs: Tariffs; stale: boolean }>
  export const tariffs: Signal<Tariffs|null>
  ```
  Navigation (hash router) : `#/calculer` (défaut), `#/comparer`, `#/tarifs`, `#/plus`. PWA : `registerType: 'autoUpdate'`, precache app shell, `tarifs.json` et `tarifs-history.json` en `StaleWhileRevalidate` ; `zadmin.html` et `/api/*` exclus du precache et de la navigation fallback. `loadTariffs` : réponse avec `schemaVersion !== SCHEMA_VERSION` → refetch `cache: 'reload'` ; si échec réseau, `stale: true` avec la dernière version valide (Review Focus 5).

- [ ] **Step 1: Tests** : `fr.json` et `mg.json` ont exactement le même jeu de clés ; `t` remplace `{montant}` ; `formatAr(1000000)` normalisé (espaces) = `'1 000 000 Ar'` ; `settings` relit le localStorage et retombe sur les défauts si absent ou JSON corrompu ; `loadTariffs` avec un fetch simulé renvoyant `schemaVersion: 0` puis la bonne version → refetch et version correcte ; fetch en échec + cache → `stale: true`.
- [ ] **Step 2–4:** FAIL → implémenter → PASS. Textes mg : marquer en tête de `mg.json` une clé `_review: "à relire par un locuteur natif"`.
- [ ] **Step 5:** `npm run build` ; vérifier taille gzip du chunk principal < 100 Ko.
- [ ] **Step 6:** Commit `feat(ui): coquille, i18n FR/MG, réglages, PWA`.

---

### Task 12: Écran Calculer (+ partage, favoris, graphique, alerte)

**Files:** Create `src/ui/screens/Calculate.tsx`, `src/ui/components/{AmountInput,OperatorPicker,ResultCard,FeeStairChart,ShareButton,FavoriteButton}.tsx`, `src/ui/state/favorites.ts`, `src/ui/share.ts` · Tests `tests/ui/{share,favorites}.test.ts`

**Interfaces:**
- Consumes: `optimizeSplit`, `inverse`, `maxWithdrawable`, `sendPaths`, `tierHint`, `settings`, `tariffs`, `t`, `formatAr`
- Produces:
  ```ts
  export type CalcMode = 'withdraw'|'send'|'receive'|'max'
  export type Favorite = { id: string; label: string; mode: CalcMode; params: Record<string, string|number|boolean> }
  export const favorites: Signal<Favorite[]>  // localStorage 'cr.favorites'
  export function addFavorite(f: Omit<Favorite,'id'>): void; export function removeFavorite(id: string): void
  export function shareText(mode: CalcMode, result: SplitOk|InverseResult|MaxResult, lang: Lang): string
  export async function share(text: string): Promise<'shared'|'copied'|'failed'>  // navigator.share, sinon clipboard
  ```
  Onglets : *Retirer* (opérateur, montant, abonné oui/non → `withdrawal` / `withdrawal_non_customer`), *Envoyer* (de, vers ou « non-abonné »), *Le destinataire doit recevoir* (montant net, opérateur source, opérateur destinataire ou « n'importe lequel », case « frais de retrait compris », défaut cochée), *Max retirable* (opérateur, solde). Calcul à chaque saisie (debounce 150 ms). Montants rapides : 10 000, 50 000, 100 000, 500 000. `ResultCard` : transactions, frais, total, « Économie : X Ar par rapport à une seule fois », alternatives (chemins suivants), `Disclaimer`. `FeeStairChart` : SVG inline en escalier des frais de la table utilisée, marqueur au montant saisi (charger le skill `dataviz` avant). Une `Fail` affiche `t('error.'+reason)`. Favori → rouvre le formulaire pré-rempli.

- [ ] **Step 1: Tests** : `shareText('withdraw', optimizeSplit(mvola,1000001,step 1))` en fr contient `1 000 000 Ar`, `1 Ar`, `8 900 Ar` et la mention indicative courte ; `share` sans `navigator.share` appelle `clipboard.writeText` et retourne `'copied'` ; favoris ajout/suppression persistés.
- [ ] **Step 2–4:** FAIL → implémenter → PASS.
- [ ] **Step 5:** Commit `feat(ui): écran Calculer`.

---

### Task 13: Comparer, Tarifs, Plus, bandeau de mise à jour

**Files:** Create `src/ui/screens/{Compare,Tariffs,More}.tsx`, `src/ui/components/{UpdateBanner,TariffTable,HistoryList}.tsx`, `src/ui/state/lastSeen.ts` · Test `tests/ui/lastSeen.test.ts`

**Interfaces:**
- Consumes: `monthlyCost`, `diffTariffs`, `formatChange`, `tariffs`, `favorites`
- Produces:
  ```ts
  export function pendingChanges(current: Tariffs, lastSeen: Tariffs|null): FeeChange[]   // [] si lastSeen null (première visite)
  export function markSeen(t: Tariffs): void   // localStorage 'cr.lastSeen'
  ```
  *Comparer* : liste éditable d'usages (opération, montant, fois par mois) → `monthlyCost`, classement avec coût mensuel par opérateur. *Tarifs* : sélecteur opérateur/opération, `TariffTable` (« non disponible » pour null), date `publishedAt`, lien source, `HistoryList` depuis `tarifs-history.json`. *Plus* : favoris, réglages, à propos. `UpdateBanner` : si `pendingChanges` non vide, bandeau « Tarifs mis à jour » + 5 premiers changements + « voir tout », bouton OK → `markSeen`.

- [ ] **Step 1: Tests** : `pendingChanges(t, null)` = `[]` ; avec un `lastSeen` dont un frais diffère → 1 changement ; après `markSeen(t)`, `pendingChanges(t, lu)` = `[]`.
- [ ] **Step 2–4:** FAIL → implémenter → PASS.
- [ ] **Step 5:** Commit `feat(ui): comparer, tarifs, historique, bandeau`.

---

### Task 14: API admin (login, parse, commit)

**Files:** Create `api/_lib/session.ts`, `api/_lib/github.ts`, `api/login.ts`, `api/parse.ts`, `api/commit.ts` · Tests `tests/api/{session,login,parse,commit}.test.ts`

**Interfaces:**
- Consumes: parsers, `validateTariffs`, `diffTariffs`, `mergeOperator`, `TariffsSchema`
- Produces:
  ```ts
  export function signSession(secret: string, now: number): string            // cookie 'cr_admin', HMAC-SHA256, exp 8 h
  export function verifySession(cookie: string|undefined, secret: string, now: number): boolean
  export function checkPassword(input: string, expected: string): boolean      // timingSafeEqual sur SHA-256
  export interface GitHubClient { getFile(path: string): Promise<{ content: string; sha: string }>; putFile(path: string, content: string, sha: string, message: string): Promise<{ commitUrl: string }> }
  export function githubClient(token: string, repo: string): GitHubClient      // API REST contents
  ```
  - `POST /api/login` `{password}` → 204 + cookie HttpOnly Secure SameSite=Strict Path=/ ; échec → 401 après délai `min(2^n, 30)` s par IP (compteur en mémoire de l'instance, suffisant).
  - `POST /api/parse` (session requise) : multipart `{operator, file}` ou JSON `{operator, url}` → `{ operator: Operator, validation: Validation, changes: FeeChange[] }` ; parser selon l'opérateur ; si le parser lève, repli `parseGenericTables` → `{ generic: [...] }` pour édition manuelle. Taille max 5 Mo ; URL limitée à `http(s)`.
  - `POST /api/commit` (session requise) `{ tariffs: Tariffs }` → validation (`invalid` → 422) → `putFile('public/tarifs.json', …, 'chore(tarifs): mise à jour via /zadmin')` → `{ commitUrl }`. Conflit de sha → 409.
  - Toutes les réponses : en-tête `X-Robots-Tag: noindex, nofollow`.

- [ ] **Step 1: Tests** : session expirée → false ; signature altérée → false ; `checkPassword` vrai/faux ; login mauvais mot de passe → 401 ; parse sans cookie → 401 ; parse fixture MVola → `changes: []`, `validation.status: 'ok'` ; commit tarifs invalides → 422 ; commit valide → `putFile` appelé une fois avec un contenu qui passe `TariffsSchema` (client GitHub simulé).
- [ ] **Step 2–4:** FAIL → implémenter → PASS.
- [ ] **Step 5:** Commit `feat(api): login, parse, commit admin`.

---

### Task 15: Page `/zadmin` et configuration Vercel

**Files:** Create `zadmin.html`, `src/admin/{main.tsx,Login.tsx,Import.tsx,TierEditor.tsx,Preview.tsx}`, `vercel.json`; Modify `vite.config.ts` (entrée multiple `index.html` + `zadmin.html`) · Test `tests/admin/tierEditor.test.ts`

**Interfaces:**
- Consumes: `/api/login`, `/api/parse`, `/api/commit`, `validateTariffs`, `diffTariffs`, `formatChange`
- Produces: `export function applyEdit(table: FeeTable, index: number, field: 'min'|'max'|'fee', value: number): FeeTable`

  `zadmin.html` : `<meta name="robots" content="noindex, nofollow">`, aucun lien depuis l'app. Écrans : Login → Import (opérateur ; dépôt PDF ; lien ; « éditer à la main ») → Preview (tableau éditable `TierEditor`, diff formaté, avertissements de validation, bouton « Publier » désactivé si `invalid`) → confirmation avec lien du commit et « en ligne dans 1–2 min ».
  `vercel.json` :
  ```json
  { "cleanUrls": true,
    "rewrites": [{ "source": "/zadmin", "destination": "/zadmin.html" }],
    "headers": [
      { "source": "/zadmin(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
      { "source": "/api/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] } ] }
  ```
  `/admin` n'a aucune route → 404 Vercel standard. Variables d'environnement : spec §9.

- [ ] **Step 1: Tests** : `applyEdit` change uniquement le champ visé et retourne une nouvelle table ; table éditée créant un trou → `validateTariffs` `invalid`.
- [ ] **Step 2–4:** FAIL → implémenter → PASS.
- [ ] **Step 5:** `npm run build` → `dist/zadmin.html` existe ; le chunk admin n'est pas importé par `dist/index.html`.
- [ ] **Step 6:** Commit `feat(admin): page /zadmin et config Vercel`.

---

### Task 16: Tests de bout en bout et README

**Files:** Create `playwright.config.ts`, `e2e/{calculate,offline,i18n,admin}.spec.ts`, `README.md`

- [ ] **Step 1: Tests E2E** (sur `vite preview`) :
  - *Retirer* MVola 1 000 001 (pas 100 dans Réglages) → affiche `8 900 Ar` et une économie.
  - *Le destinataire doit recevoir* 100 000, MVola→MVola, frais compris → `101 900 Ar` à envoyer.
  - *Max retirable* MVola solde 487 350 → un montant affiché, mention indicative visible.
  - Hors-ligne : charger, `context.setOffline(true)`, recharger → le calcul fonctionne.
  - Langue : passage en `mg` change le libellé de la navigation et persiste au rechargement.
  - `/admin` → 404 ; `/zadmin` → page de connexion avec meta robots `noindex`.
- [ ] **Step 2:** `npm run e2e` → PASS.
- [ ] **Step 3:** `README.md` : objectif, commandes, déploiement Vercel (import du dépôt, variables §9, `VERCEL_DEEP_CLONE=true`), fonctionnement de la mise à jour auto (PR/Issue), utilisation de `/zadmin`, procédure si le PDF Orange n'est pas récupérable automatiquement.
- [ ] **Step 4:** `npm test && npm run build && npm run e2e` → tout vert.
- [ ] **Step 5:** Commit `test: e2e + README`.
