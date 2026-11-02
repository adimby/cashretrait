import { t } from '../i18n'

/** Mandatory notice (F17). Shown at the end of every screen, and under every result (`compact`). */
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return <p class={compact ? 'disclaimer disclaimer-compact' : 'disclaimer'}>{t('disclaimer')}</p>
}
