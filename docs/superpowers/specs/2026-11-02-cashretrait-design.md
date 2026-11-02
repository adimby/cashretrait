# CashRetrait — Spécification de conception (v1)

Date : 2026-11-02 · Statut : en revue

## 1. Objectif

PWA gratuite, grand public, qui calcule la manière **la moins chère** de retirer ou transférer de l'argent avec les opérateurs mobile money à Madagascar (MVola, Airtel Money, Orange Money).

Critères de succès :
- Le découpage proposé est prouvé optimal (vérifié contre une force brute en test).
- L'app fonctionne hors-ligne après la première visite et pèse peu (cible < 100 Ko JS gzip hors admin).
- Les tarifs se mettent à jour automatiquement chaque jour, sans base de données, sans casser l'app si une source change.
- Interface en français et en malgache.

### Contraintes
- Hébergement Vercel, **aucune base de données**. `public/tarifs.json` versionné dans Git est la source de vérité.
- Aucune exécution d'opération à la place de l'utilisateur (pas de code USSD, pas de lien de composition) — l'app est indicative uniquement.

## 2. Périmètre

### v1
| # | Fonctionnalité |
|---|---|
| F1 | Découpage optimal d'un **retrait** (opérateur, montant, abonné / non-abonné) |
| F2 | Découpage optimal d'un **transfert** intra-opérateur et inter-opérateurs |
| F3 | **Calcul inverse** : « le destinataire doit avoir X Ar en main », option « frais de retrait compris » |
| F4 | Comparaison de tous les chemins disponibles (intra, inter, non-abonné), classés par coût |
| F5 | **Montant maximal retirable** depuis un solde donné, frais compris |
| F6 | **Alerte palier proche** pendant la saisie (« avec 25 000 Ar tu paies 650 au lieu de 1 300 ») |
| F7 | **Partage du résultat** (Web Share API ; repli : copie du texte) |
| F8 | **Bandeau « tarifs mis à jour »** avec résumé des changements depuis la dernière visite |
| F9 | **Opérateur le moins cher pour moi** : estimation du coût mensuel selon des usages habituels |
| F10 | **Favoris** de calculs (localStorage) |
| F11 | **Graphique pédagogique** des paliers (escalier des frais, position du montant saisi) |
| F12 | **Historique des tarifs** : évolution des frais par palier |
| F13 | Page **Tarifs** : grilles consultables, date et lien vers la source officielle |
| F14 | **Réglages** : langue FR/MG, pas d'arrondi (100 / 1 000 / 5 000, défaut 1 000), max transactions (1–10, défaut 5) |
| F15 | **Mise à jour auto** des tarifs (GitHub Action quotidienne) |
| F16 | **Admin `/zadmin`** : import PDF / lien / édition manuelle, commit via API GitHub |
| F17 | Mentions : calcul indicatif, app indépendante non affiliée aux opérateurs |

### Hors périmètre (v2 ou jamais)
- v2 : comparaison « retrait + redépôt chez l'autre opérateur » vs transfert inter-opérateurs ; mode ultra-léger / 2G.
- Exclu : codes USSD, plafonds journaliers cumulés, frais bancaires, paiement marchand, comptes utilisateurs.

## 3. Architecture

Stack : **Vite + Preact + TypeScript**, `vite-plugin-pwa` (Workbox), Zod, Vitest, Playwright. Scripts Node (tsx) pour le scraping, cheerio (HTML), pdfjs-dist (PDF). Fonctions serverless Vercel dans `api/`.

```
cashretrait/
├─ src/
│  ├─ engine/            TS pur, aucune dépendance UI/DOM
│  │  ├─ fees.ts         feeFor(table, amount) → number | null
│  │  ├─ optimize.ts     optimizeSplit, inverse, maxWithdrawable
│  │  ├─ paths.ts        énumération et classement des chemins (F4)
│  │  └─ hints.ts        alerte palier proche (F6)
│  ├─ tariffs/
│  │  ├─ schema.ts       schéma Zod partagé
│  │  ├─ validate.ts     contrôles de cohérence + diff lisible
│  │  └─ parsers/        airtel.ts, mvola.ts, orange.ts, generic.ts
│  ├─ ui/                Preact : écrans, composants, i18n (fr.json, mg.json)
│  └─ admin/             code /zadmin, chargé à part (lazy)
├─ public/tarifs.json
├─ public/tarifs-history.json   généré au build depuis l'historique Git (F12)
├─ api/parse.ts, api/commit.ts, api/login.ts
├─ scripts/update-tariffs.ts, scripts/build-history.ts
├─ tests/fixtures/       copies figées HTML Airtel, MVola, PDF Orange
├─ .github/workflows/update-tariffs.yml
└─ vercel.json
```

Flux principal : navigateur → `tarifs.json` (cache service worker, stale-while-revalidate) → moteur local → affichage. Aucun appel serveur pour calculer.

## 4. Format `tarifs.json`

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-02T03:00:00Z",
  "operators": {
    "mvola": {
      "name": "MVola",
      "source": { "url": "https://mvola.mg/tarifs/", "type": "html", "publishedAt": "2025-02-17" },
      "limits": { "minTx": 100, "maxTx": 20000000, "maxBalance": 20000000 },
      "fees": {
        "withdrawal":              [ { "min": 100, "max": 1000, "fee": 100 } ],
        "withdrawal_non_customer": [],
        "transfer_same":           [],
        "transfer_other_op":       [],
        "transfer_non_customer":   []
      }
    },
    "airtel": {},
    "orange": {}
  }
}
```

Règles :
- Un palier : `{ min, max, fee }` ou `{ min, max, feePercent }` (montants en Ariary entiers, bornes incluses).
- Montant hors de tout palier ou case vide de la grille = **opération non disponible** (jamais « gratuit » implicitement). « Gratuit » explicite = `fee: 0`.
- Une liste vide = opération non proposée par l'opérateur.

Contrôles de cohérence (`validate.ts`) :
1. Paliers triés, contigus (`next.min = prev.max + 1`), sans chevauchement.
2. Frais non décroissants d'un palier au suivant (avertissement seulement).
3. Aucun opérateur ni opération présente auparavant ne disparaît.
4. Variation > 50 % d'un frais existant → suspect.
5. Bornes cohérentes avec `limits`.

Résultat : `ok` | `suspect` (liste de raisons) | `invalid`.

## 5. Moteur de calcul

### 5.1 Découpage optimal — `optimizeSplit(table, amount, { step, maxTx, limits })`
Propriété : pour des frais à paliers fixes, il existe une solution optimale où toutes les transactions sauf une sont au plafond (arrondi au pas, vers le bas) d'un palier. Augmenter une transaction jusqu'au plafond de son palier ne change pas son frais et réduit le reste.

Algorithme :
1. Candidats C = { floor(max_i / step) × step } pour chaque palier disponible, filtrés par `limits`.
2. Pour k = 1..maxTx : combinaisons avec répétition de k−1 éléments de C ; reste r = amount − somme ; valide si r est un multiple du pas (sauf si le montant lui-même ne l'est pas : alors seul le reste porte l'appoint) et si r est dans les limites et dans un palier disponible.
3. Coût = Σ frais. Minimum ; égalité → moins de transactions ; puis montants les plus réguliers.
4. Retourne `{ transactions: [{ amount, fee }], total, single: { fee | null }, savings }`.

Paliers en pourcentage : les candidats restent les plafonds, plus une recherche par pas sur les paliers en pourcentage pour la transaction de reste ; la propriété n'est plus prouvée dans ce cas — la force brute de test couvre ces tables.

Complexité : ≤ ~30 candidats, k−1 ≤ 9 avec répétition ; élagage par borne (coût courant ≥ meilleur) et arrêt dès que k transactions ne peuvent plus battre le meilleur. Cible : < 50 ms sur mobile d'entrée de gamme pour maxTx = 5.

### 5.2 Calcul inverse — `inverse({ net, from, to, includeWithdrawalFee, ... })`
1. Retrait optimal de `net` chez l'opérateur du destinataire → coût R, découpage W.
2. Montant à envoyer T = net + R si `includeWithdrawalFee`, sinon T = net.
3. Transfert optimal de T (table `transfer_same` ou `transfer_other_op`) → coût F.
4. Résultat : T, découpage du transfert, découpage du retrait, coût total F + R.

### 5.3 Montant maximal retirable — `maxWithdrawable(table, balance, opts)` (F5)
Plus grand montant M (multiple du pas) tel que M + coût optimal du retrait de M ≤ balance. Recherche dichotomique sur M ; la fonction coût étant non monotone localement, on vérifie aussi les plafonds de paliers proches de la borne trouvée.

### 5.4 Chemins (F4), alerte palier (F6), opérateur moins cher (F9)
- `paths.ts` : pour un envoi, énumère intra-opérateur, inter-opérateurs, non-abonné ; exclut les chemins non disponibles ; trie par coût total.
- `hints.ts` : si un montant légèrement inférieur (≤ 2 % ou ≤ 1 pas sous un plafond) fait économiser ≥ 20 % du frais, propose-le.
- F9 : l'utilisateur saisit des usages (type d'opération, montant, fréquence par mois) ; coût mensuel = Σ coût optimal × fréquence, par opérateur.

### 5.5 Erreurs
Montant ≤ 0, non entier, hors limites, opération indisponible → résultat typé `{ ok: false, reason }`, traduit par l'UI. Le moteur ne lève jamais d'exception pour une saisie utilisateur.

## 6. Mise à jour des tarifs

### 6.1 Automatique — GitHub Action
- Planification : quotidienne à 06:00 heure de Madagascar (`0 3 * * *` UTC) + `workflow_dispatch`.
- `scripts/update-tariffs.ts` : pour chaque opérateur indépendamment → téléchargement → parser → Zod → `validate.ts` contre le `tarifs.json` actuel.
  - Aucun changement → rien.
  - `ok` → commit sur `main` (Vercel redéploie).
  - `suspect` / `invalid` → PR avec diff lisible (« MVola retrait 25 001–50 000 : 1 300 → 1 500 »).
  - Source inaccessible ou parser en échec → Issue (dédupliquée par titre). Les tarifs existants restent actifs.
- Un opérateur en échec n'empêche pas la mise à jour des autres.
- Sources : Airtel `https://www.airtel.mg/airtelmoney/transaction_fees` (HTML) ; MVola `https://mvola.mg/tarifs/` (HTML, date « au JJ-MM-AAAA ») ; Orange `https://www.orange.mg/omg-b2c/resources/other/PLAN_TARIFS_ORANGE_MONEY_MAJ_1_A4.pdf` (PDF). L'accès au PDF Orange depuis GitHub Actions est à vérifier en premier ; repli : import manuel via `/zadmin`.

### 6.2 Manuelle — `/zadmin`
- Écran de connexion ; `api/login` compare à `ADMIN_PASSWORD` (comparaison à temps constant), renvoie un cookie signé HttpOnly (secret `ADMIN_SESSION_SECRET`, durée 8 h). Délai croissant après échec.
- Trois modes : dépôt PDF, lien (HTML ou PDF), édition manuelle dans un tableau.
- `api/parse` : applique le parser de l'opérateur choisi (repli : parser générique de tableaux) ; retourne JSON + résultat de validation.
- Aperçu : diff lisible, avertissements de cohérence ; l'admin peut corriger avant de valider.
- `api/commit` : commit de `tarifs.json` sur `main` via l'API GitHub (`GITHUB_TOKEN` fine-grained, droits contents:write sur ce seul dépôt).
- Discrétion : `/admin` → 404 standard ; en-tête `X-Robots-Tag: noindex, nofollow` sur `/zadmin` et `/api/*` (vercel.json) ; `<meta name="robots" content="noindex">` ; aucun lien, absent du sitemap, **pas** cité dans `robots.txt` ; JS admin dans un chunk séparé non référencé par l'app publique.

### 6.3 Historique (F12)
`scripts/build-history.ts` lit `git log` de `public/tarifs.json` au build Vercel et produit `tarifs-history.json` (changements par opérateur, opération, palier, date). Le build Vercel doit cloner avec suffisamment de profondeur (`VERCEL_DEEP_CLONE=true`).

### 6.4 Côté client (F8)
Le service worker récupère le nouveau `tarifs.json` dès qu'il y a du réseau. L'app mémorise `updatedAt` vu en dernier ; si différent, bandeau avec résumé du diff.

## 7. Interface

Mobile d'abord, grands boutons, contraste élevé, montants formatés « 1 000 000 Ar ».

Navigation (barre du bas) : **Calculer** · **Comparer** · **Tarifs** · **Plus** (Favoris, Réglages, À propos).

- **Calculer** : onglets *Retirer* · *Envoyer* · *Le destinataire doit recevoir* · *Max retirable*. Calcul en direct, montants rapides, alerte palier proche. Résultat : carte « Meilleure option » (transactions, frais, total, économie vs une fois), alternatives, graphique en escalier, boutons Partager et ★ Favori.
- **Comparer** (F9) : saisie d'usages habituels → coût mensuel par opérateur.
- **Tarifs** : grilles, date, source, historique (F12).
- **Plus** : favoris, réglages, à propos + mentions légales.
- i18n : fichiers `fr.json` et `mg.json` ; textes malgaches à faire relire par un locuteur natif.
- PWA : manifest, icônes, installable, hors-ligne complet hors `/zadmin`.

## 8. Tests
- **Moteur** : comparaison avec force brute (tous découpages, petits montants, tables réelles et synthétiques dont pourcentages) ; cas réels (ex. MVola retrait 1 000 001 Ar → 1 000 000 + 1 = 8 900 Ar au lieu de 14 700) ; limites ; paliers indisponibles ; inverse ; max retirable ; alerte palier.
- **Parsers** : fixtures figées HTML Airtel, MVola et PDF Orange → JSON attendu.
- **Schéma / validation** : cas invalides et suspects rejetés ou signalés.
- **API admin** : login (succès, échec, délai), parse, commit (client GitHub simulé).
- **E2E Playwright** : un parcours par onglet, hors-ligne, changement de langue, `/admin` → 404, en-tête noindex sur `/zadmin`.

## 9. Variables d'environnement
| Nom | Où | Rôle |
|---|---|---|
| `ADMIN_PASSWORD` | Vercel | mot de passe /zadmin |
| `ADMIN_SESSION_SECRET` | Vercel | signature du cookie de session |
| `GITHUB_TOKEN` | Vercel | commit depuis /zadmin |
| `GITHUB_REPO` | Vercel | `adimby/cashretrait` |
| `VERCEL_DEEP_CLONE` | Vercel | historique Git pour F12 |
| `GITHUB_TOKEN` (auto) | Actions | commit / PR / Issue du workflow |

## 10. Risques
- Changement de format des sites → détecté par validation, PR/Issue, anciens tarifs conservés.
- PDF Orange inaccessible ou mal structuré → import manuel.
- Erreur de calcul → tests force brute + mention « indicatif ».
- Traduction malgache approximative → relecture native avant mise en production.
