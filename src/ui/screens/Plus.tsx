import { t } from '../i18n'
import { Icon } from '../components/Icon'

const ITEMS = [
  { href: '#/plus/favoris', key: 'favoris', icon: 'star' },
  { href: '#/plus/reglages', key: 'reglages', icon: 'sliders' },
  { href: '#/plus/apropos', key: 'apropos', icon: 'info' },
] as const

export function Plus() {
  return (
    <section class="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" class="screen-title" tabIndex={-1}>{t('plus.title')}</h1>
      <ul class="board-list">
        {ITEMS.map((it) => (
          <li key={it.key}>
            <a class="board-row" href={it.href}>
              <span class="board-row-icon"><Icon name={it.icon} /></span>
              <span class="board-row-text">
                <span class="board-row-title">{t(`plus.${it.key}`)}</span>
                <span class="board-row-desc">{t(`plus.${it.key}.desc`)}</span>
              </span>
              <span class="board-row-end"><Icon name="chevron" /></span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function BackLink() {
  return (
    <a class="backlink" href="#/plus"><Icon name="back" size={20} />{t('back')}</a>
  )
}
