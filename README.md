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

- `BASE_URL=https://votre-deploiement.vercel.app npm run e2e` lance en plus un test de fumée contre un déploiement réel : `/admin` répond 404 et la page d'administration porte `X-Robots-Tag: noindex, nofollow`. Sans `BASE_URL`, ce test est ignoré.

Les e2e ne sont **pas** dans le workflow CI (`.github/workflows/ci.yml` lance `npm test` et `npm run build`) : ils exigent le téléchargement d'un navigateur et prolongent chaque exécution. Lancez-les avant une publication importante.

Un point n'est pas testable avec `vite preview` : `/admin` doit répondre **404** et les en-têtes (`X-Robots-Tag`, `Cache-Control: no-store`) de la page d'administration et de `/api/*` sont posés par `vercel.json`. `vite preview` renvoie la page d'accueil pour toute adresse inconnue. Ces deux points se vérifient sur le déploiement Vercel (test de fumée `BASE_URL`, ci-dessus).

## Déploiement sur Vercel

1. Sur Vercel, **Add New… › Project**, puis importez le dépôt GitHub `adimby/cashretrait`. Vercel détecte Vite ; la commande de build est `npm run build`, le dossier de sortie `dist`.
2. Dans **Settings › Environment Variables**, définissez :

| Variable | Valeur |
| --- | --- |
| `ADMIN_PASSWORD` | Mot de passe de la page d'administration : **long et aléatoire** (au moins 20 caractères, généré par un gestionnaire de mots de passe). Le ralentissement après des échecs de connexion est gardé en mémoire **par instance** de fonction et repart à zéro à chaque démarrage à froid : il freine les essais, il ne remplace pas un mot de passe fort. |
| `ADMIN_SESSION_SECRET` | Secret aléatoire d'au moins **32 caractères** (signature de la session) |
| `GITHUB_TOKEN` | Jeton GitHub *fine-grained*, limité à **ce seul dépôt**, permission **Contents : Read and write** |
| `GITHUB_REPO` | `adimby/cashretrait` |
| `VERCEL_DEEP_CLONE` | `true` : le build lit l'historique git pour `tarifs-history.json`. Ne s'applique qu'aux builds lancés depuis la connexion Git (un déploiement par la CLI n'a pas d'historique : l'historique affiché est alors vide). |

3. Déployez. Les fonctions `api/login`, `api/parse` et `api/commit` et les en-têtes sont configurés par `vercel.json`.
4. Vérifiez sur le site déployé : `/admin` répond 404, la page d'administration porte `X-Robots-Tag: noindex, nofollow`, et un enregistrement depuis l'administration crée bien un commit.

Dans **Settings › Git**, la **branche de production doit être `main`** et le projet doit rester connecté au dépôt GitHub : c'est cette connexion Git qui redéploie automatiquement à chaque commit sur `main`, y compris ceux de la mise à jour automatique et de l'administration. Sans elle, les nouveaux tarifs sont commités mais jamais publiés.

> **État actuel.** Le déploiement en ligne a été construit depuis la branche de travail (`claude/focused-goldberg-8jf0bg`), pas depuis `main`. Tant que cette branche n'est pas fusionnée dans `main`, les commits de la mise à jour automatique (qui visent `main`) ne mettent pas ce déploiement à jour.

## Réglages du dépôt GitHub

Pour que le workflow `.github/workflows/update-tariffs.yml` fonctionne :

- **Settings › Actions › General › Workflow permissions** : *Read and write permissions*.
- Cochez **Allow GitHub Actions to create and approve pull requests**.
- Si la branche `main` est protégée, la règle doit **autoriser `github-actions[bot]`** à pousser (contournement de la règle). Sinon le job échoue au moment du `git push`.

## Mise à jour automatique des tarifs

Le workflow s'exécute chaque jour à 03:00 UTC (et à la demande : *Actions › Update tariffs › Run workflow*), sous Node 22. Il lance `npm run update-tariffs`, qui récupère les grilles de chaque opérateur, les lit, les valide (schéma, paliers contigus, limites, écarts) et les compare à `public/tarifs.json`. Chaque opérateur est traité indépendamment. Selon le résultat :

- **Changement plausible** : le workflow lance `npm test`, puis **commit directement sur `main`** (`chore(tarifs): mise à jour automatique`). Les tests vérifient les valeurs sur un **instantané figé** (`tests/fixtures/tarifs.snapshot.json`) et non sur le fichier en ligne : un vrai changement de frais ne les casse donc pas ; seuls le schéma et la validation lisent le nouveau `public/tarifs.json`. Vercel redéploie (voir la connexion Git ci-dessus).
- **Changement suspect** (écart trop grand) : rien n'est poussé sur `main`. Le workflow pousse une branche `tarifs/auto-…` et ouvre (ou met à jour) une **Pull Request** à relire et à fusionner à la main, ou à fermer si le changement est faux.
- **Grille illisible ou invalide, source inaccessible** : le workflow ouvre une **Issue** « Mise à jour tarifs échouée : <opérateur> » (une seule par opérateur tant qu'elle est ouverte). Les anciens tarifs restent en ligne.
- **Échec des tests ou du commit/push vers `main`** : rien n'est publié et le workflow ouvre l'**Issue** « Mise à jour tarifs : échec du commit », ou y ajoute un commentaire avec le lien de l'exécution si elle est déjà ouverte.

Quand les grilles officielles changent, pensez à mettre à jour les fixtures (`tests/fixtures/*.html`, `orange.pdf`) **et** `tests/fixtures/tarifs.snapshot.json` ensemble, si vous voulez que les tests suivent les nouveaux frais.

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
