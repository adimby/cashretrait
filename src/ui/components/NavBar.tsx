import { t } from '../i18n'
import { route, tabOf, TABS } from '../state/route'
import { Icon } from './Icon'

export function NavBar() {
  const active = tabOf(route.value)
  return (
    <nav class="navbar" aria-label={t('nav.label')}>
      <ul>
        {TABS.map((tab) => (
          <li key={tab}>
            <a href={`#/${tab}`} class="navbar-item" aria-current={tab === active ? 'page' : undefined}>
              <span class="navbar-icon"><Icon name={tab} /></span>
              <span class="navbar-label">{t(`nav.${tab}`)}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
