import { t } from '../i18n'

/** Mandatory notice (F17). Shown at the end of every screen. */
export function Disclaimer() {
  return <p class="disclaimer">{t('disclaimer')}</p>
}
