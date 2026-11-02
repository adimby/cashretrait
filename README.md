# CashRetrait

Application web (PWA, français et malagasy) qui calcule **le moyen le moins cher de retirer ou d'envoyer de l'argent** avec MVola, Airtel Money et Orange Money à Madagascar : découpage en plusieurs transactions, montant à envoyer pour que le destinataire reçoive une somme donnée, retrait maximal pour un solde donné. Elle fonctionne hors ligne.

Les tarifs sont dans `public/tarifs.json`. Ils sont mis à jour chaque jour par une GitHub Action, et à la main depuis une page d'administration cachée.

> **Avertissement.** CashRetrait est une application **indépendante**, non affiliée à MVola, Airtel ou Orange. Les résultats sont **indicatifs** : ils reposent sur les grilles publiques des opérateurs, qui peuvent changer. Vérifiez toujours le montant auprès de l'opérateur avant de valider.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm install` | Installe les dépendances |
| `npm run dev` | Serveur de développement Vite |
| `npm test` | Tests unitaires (Vitest) |
| `npm run build` | Génère les données d'historique, vérifie les types, construit `dist/` et vérifie qu'aucun nom réservé ne fuit dans les fichiers publics |
| `npm run preview` | Sert `dist/` en local |
| `npm run e2e` | Tests de bout en bout (Playwright), voir ci-dessous |
| `npm run update-tariffs` | Récupère les tarifs chez les opérateurs et met à jour `public/tarifs.json` (écrit aussi `update-report.json`) |

### Tests de bout en bout

`npm run e2e` construit l'application, lance `vite preview` sur le port 4173 et exécute les scénarios de `e2e/` : calculs de référence, mode hors ligne (service worker), changement de langue, non-affichage de l'administration sur `/admin` et `noindex` sur la page d'administration.

- Première fois : `npx playwright install chromium`.
- Navigateur déjà présent sur la machine : `PW_CHROMIUM_PATH=/chemin/vers/chromium npm run e2e`.
- `E2E_SKIP_BUILD=1` réutilise le `dist/` existant.

Les e2e ne sont **pas** dans le workflow CI (`.github/workflows/ci.yml` lance `npm test` et `npm run build`) : ils exigent le téléchargement d'un navigateur et prolongent chaque exécution. Lancez-les avant une publication importante.

Un point n'est pas testable avec `vite preview` : `/admin` doit répondre **404** et les en-têtes (`X-Robots-Tag`, `Cache-Control: no-store`) de la page d'administration et de `/api/*` sont posés par `vercel.json`. `vite preview` renvoie la page d'accueil pour toute adresse inconnue. Ces deux points se vérifient sur le déploiement Vercel.

## Déploiement sur Vercel

1. Sur Vercel, **Add New… › Project**, puis importez le dépôt GitHub `adimby/cashretrait`. Vercel détecte Vite ; la commande de build est `npm run build`, le dossier de sortie `dist`.
2. Dans **Settings › Environment Variables**, définissez :

| Variable | Valeur |
| --- | --- |
| `ADMIN_PASSWORD` | Mot de passe de la page d'administration |
| `ADMIN_SESSION_SECRET` | Secret aléatoire d'au moins **32 caractères** (signature de la session) |
| `GITHUB_TOKEN` | Jeton GitHub *fine-grained*, limité à **ce seul dépôt**, permission **Contents : Read and write** |
| `GITHUB_REPO` | `adimby/cashretrait` |
| `VERCEL_DEEP_CLONE` | `true` (le build lit l'historique git pour `tarifs-history.json`) |

3. Déployez. Les fonctions `api/login`, `api/parse` et `api/commit` et les en-têtes sont configurés par `vercel.json`.
4. Vérifiez sur le site déployé : `/admin` répond 404, la page d'administration porte `X-Robots-Tag: noindex, nofollow`, et un enregistrement depuis l'administration crée bien un commit.

Chaque commit sur `main` (y compris ceux de la mise à jour automatique) déclenche un nouveau déploiement.

## Réglages du dépôt GitHub

Pour que le workflow `.github/workflows/update-tariffs.yml` fonctionne :

- **Settings › Actions › General › Workflow permissions** : *Read and write permissions*.
- Cochez **Allow GitHub Actions to create and approve pull requests**.
- Si la branche `main` est protégée, la règle doit **autoriser `github-actions[bot]`** à pousser (contournement de la règle). Sinon le job échoue au moment du `git push`.

## Mise à jour automatique des tarifs

Le workflow s'exécute chaque jour à 03:00 UTC (et à la demande : *Actions › Update tariffs › Run workflow*). Il lance `npm run update-tariffs`, qui récupère les grilles de chaque opérateur et les compare à `public/tarifs.json`. Selon le résultat :

- **Changement plausible** : les tests passent, puis le workflow **commit directement sur `main`** (`chore(tarifs): mise à jour automatique`). Vercel redéploie.
- **Changement suspect** (écart trop grand, grille incohérente) : rien n'est poussé sur `main`. Le workflow ouvre une **Pull Request** à relire et à fusionner à la main, ou la ferme si le changement est faux.
- **Source inaccessible ou illisible** : le workflow ouvre une **Issue** qui indique l'opérateur concerné. Les anciens tarifs restent en ligne.

## Page d'administration (`/zadmin`)

Page non référencée, protégée par `ADMIN_PASSWORD`, qui sert à mettre à jour les tarifs sans toucher au dépôt. Ouvrez `/zadmin` et connectez-vous. Quatre façons de fournir une grille :

1. **PDF** : déposez le PDF officiel de l'opérateur.
2. **Page HTML enregistrée** : enregistrez la page de tarifs depuis votre navigateur (Ctrl+S, « Page web complète » ou « HTML seulement ») et déposez le fichier. C'est la méthode à utiliser pour **Airtel Money**, dont le site s'affiche par JavaScript et ne peut pas être lu automatiquement.
3. **URL** : indiquez l'adresse d'une page ou d'un PDF public.
4. **Saisie manuelle** : modifiez les paliers directement dans le tableau.

Dans tous les cas, l'administration affiche un aperçu des différences. Vérifiez-les, puis enregistrez : l'application crée un commit sur `main` avec le `GITHUB_TOKEN`.

Si l'enregistrement répond **409** (conflit), quelqu'un d'autre, ou la mise à jour automatique, a modifié `tarifs.json` entre-temps : rechargez la page pour repartir de la version actuelle, puis refaites votre modification.

### Si le PDF Orange ou la page Airtel n'est pas récupérable automatiquement

L'Issue ouverte par le workflow indique la source en échec. Dans ce cas :

1. Récupérez à la main le PDF de tarifs Orange Money (ou enregistrez la page Airtel Money depuis votre navigateur).
2. Ouvrez `/zadmin`, déposez le fichier, relisez l'aperçu, puis enregistrez.
3. Si l'adresse officielle a changé, mettez à jour `operators.<opérateur>.source.url` dans `public/tarifs.json` et fermez l'Issue.

## Modifier le format des tarifs

Le schéma de `tarifs.json` est **strict** : une clé inconnue est refusée. Pour ajouter une clé (nouvel opérateur, nouveau type de frais…), incrémentez `schemaVersion` dans `public/tarifs.json` **et** dans le schéma (`src/tariffs/schema.ts`, où il est typé et validé par `z.literal`). Les clients qui ont encore l'ancienne version rechargent alors les données au lieu de les lire de travers.

## Traductions

Les textes sont dans `src/ui/i18n/fr.json` et `mg.json`. **Les textes malagasy (`mg`) doivent être relus par un locuteur natif** avant publication : ils n'ont pas été validés.

## Confidentialité et indépendance

Aucun compte, aucun suivi. Les réglages et les favoris restent dans le navigateur. L'application n'utilise ni logo ni couleur d'opérateur et n'a aucun lien avec MVola, Airtel ou Orange.
