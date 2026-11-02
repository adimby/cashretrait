import { t } from '../i18n'

/** Shell screen for features built in later tasks: title, what it will do, honest "coming" note. */
export function Placeholder({ id }: { id: 'calculer' | 'comparer' | 'tarifs' | 'favoris' }) {
  return (
    <section class="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" class="screen-title" tabIndex={-1}>{t(`${id}.title`)}</h1>
      <p class="lead">{t(`${id}.intro`)}</p>
      <p class="notice">{t('soon')}</p>
    </section>
  )
}
