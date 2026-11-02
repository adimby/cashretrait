// Every admin string (French only: the admin is the owner). Kept out of src/ui/i18n on purpose.
import type { OperationKey, OperatorId } from '../tariffs/schema'

export const S = {
  appbar: 'Administration',
  backToApp: 'Ouvrir l’application',

  login: {
    title: 'Connexion',
    lead: 'Mise à jour des grilles de frais publiées dans l’application.',
    password: 'Mot de passe',
    submit: 'Se connecter',
    pending: 'Vérification…',
    wrong: 'Mot de passe incorrect.',
    wait: (s: number) => `Trop d’essais. Réessayez dans ${s} s.`,
    notConfigured: 'Administration non configurée sur le serveur (ADMIN_PASSWORD, ADMIN_SESSION_SECRET).',
    expired: 'Session expirée : reconnectez-vous.',
  },

  import: {
    title: 'Importer une grille',
    operator: 'Opérateur',
    mode: 'Source',
    modes: { file: 'Fichier', url: 'Lien', manual: 'À la main' },
    file: 'Fichier PDF ou page HTML enregistrée',
    fileHelp: 'PDF de la grille, ou page de l’opérateur enregistrée depuis le navigateur (.html). 4,5 Mo au plus.',
    url: 'Adresse de la page ou du PDF',
    urlHelp: 'Le serveur télécharge la page et lit la grille.',
    manualHelp: 'Part de la grille publiée en ce moment, à corriger dans le tableau.',
    submit: { file: 'Lire le fichier', url: 'Lire le lien', manual: 'Éditer à la main' },
    pending: 'Lecture en cours…',
    noFile: 'Choisissez un fichier.',
    noUrl: 'Saisissez une adresse.',
    loadFailed: 'Impossible de charger tarifs.json publié.',
  },

  preview: {
    origin: {
      parse: 'Aperçu de la grille lue automatiquement. Corrigez si besoin, puis publiez.',
      generic: 'Lecture automatique impossible : reprenez un tableau ou corrigez la grille publiée.',
      manual: 'Édition manuelle de la grille publiée.',
    },
    column: (n: number) => `Colonne ${n}`,
    operationOption: (name: string, n: number | null) => (n === null ? `${name} (absente)` : `${name} (${n} paliers)`),
    limitsAndSource: 'Limites et source',
    parserError: 'Le lecteur de cet opérateur a échoué :',
    rawTitle: 'Tableaux trouvés dans le document',
    rawNone: 'Aucun tableau lisible : saisissez les paliers à la main.',
    rawTable: (i: number, n: number) => `Tableau ${i} (${n} lignes)`,
    mapTitle: 'Reprendre un tableau',
    mapHelp: 'Choisissez les colonnes, puis remplissez la grille sélectionnée ci-dessous. Vérifiez ensuite chaque palier.',
    mapTable: 'Tableau',
    mapRange: 'Colonne des tranches (« 100 - 1 000 »)',
    mapMin: 'ou colonne « de »',
    mapMax: 'colonne « à »',
    mapFee: 'Colonne des frais',
    mapNone: '—',
    mapApply: (op: string) => `Remplir « ${op} »`,
    mapEmpty: 'Aucune ligne lisible avec ces colonnes.',
    mapDone: (n: number) => `${n} paliers repris.`,
    operation: 'Grille',
    minTx: 'Montant minimum',
    maxTx: 'Montant maximum par opération',
    maxBalance: 'Solde maximum',
    sourceUrl: 'Adresse de la source',
    sourceType: 'Type',
    publishedAt: 'Date de publication (AAAA-MM-JJ, vide si inconnue)',
    validation: 'Contrôle',
    status: { ok: 'Cohérent', suspect: 'À vérifier', invalid: 'Invalide' },
    statusHelp: {
      ok: 'Aucune anomalie détectée.',
      suspect: 'Publication possible : relisez les points ci-dessous.',
      invalid: 'Publication bloquée : corrigez les points ci-dessous.',
    },
    changes: 'Changements',
    noChanges: 'Aucun frais modifié.',
    publish: 'Publier',
    publishing: 'Publication…',
    back: 'Retour',
    conflict: 'tarifs.json a changé entre-temps. Rechargez et recommencez l’import.',
    reload: 'Recharger',
  },

  tiers: {
    absent: 'Cette grille n’existe pas pour cet opérateur.',
    create: 'Créer cette grille',
    drop: 'Supprimer cette grille',
    min: 'De',
    max: 'À',
    fee: 'Frais',
    unit: 'Unité',
    remove: 'Retirer',
    add: 'Ajouter un palier',
    row: (i: number) => `Palier ${i}`,
    empty: 'Aucun palier.',
  },

  done: {
    title: 'Publié',
    lead: 'Le commit est sur main. En ligne dans 1–2 min, après le déploiement.',
    commit: 'Voir le commit',
    again: 'Nouvel import',
  },

  error: {
    network: 'Pas de réponse du serveur. Vérifiez la connexion.',
    generic: (status: number) => `Erreur ${status}.`,
    tooBig: 'Fichier trop volumineux (4,5 Mo au plus).',
  },
}

export const OPERATOR_NAMES: Record<OperatorId, string> = { mvola: 'MVola', airtel: 'Airtel Money', orange: 'Orange Money' }

export const OPERATION_NAMES: Record<OperationKey, string> = {
  withdrawal: 'Retrait',
  withdrawal_non_customer: 'Retrait non-abonné',
  transfer_same: 'Transfert',
  transfer_same_app: 'Transfert appli',
  transfer_other_op: 'Transfert autres opérateurs',
  transfer_non_customer: 'Transfert non-abonné',
}
