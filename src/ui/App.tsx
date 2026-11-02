import { useEffect, useRef } from 'preact/hooks'
import { route, tabOf } from './state/route'
import { t, lang } from './i18n'
import { Header } from './components/Header'
import { NavBar } from './components/NavBar'
import { Disclaimer } from './components/Disclaimer'
import { Placeholder } from './screens/Placeholder'
import { Plus } from './screens/Plus'
import { Settings } from './screens/Settings'
import { About } from './screens/About'
import { Calculate } from './screens/Calculate'

function Screen({ path }: { path: string }) {
  switch (path) {
    case '/comparer': return <Placeholder id="comparer" />
    case '/tarifs': return <Placeholder id="tarifs" />
    case '/plus': return <Plus />
    case '/plus/favoris': return <Placeholder id="favoris" />
    case '/plus/reglages': return <Settings />
    case '/plus/apropos': return <About />
    default:
      return path.startsWith('/plus') ? <Plus /> : path.startsWith('/comparer') ? <Placeholder id="comparer" />
        : path.startsWith('/tarifs') ? <Placeholder id="tarifs" /> : <Calculate />
  }
}

export function App() {
  const path = route.value
  const l = lang.value
  useEffect(() => { document.documentElement.lang = l }, [l])
  useEffect(() => { document.title = `${t('app.name')}: ${t('app.tagline')}` }, [l])
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    // New screen: start at the top and move focus to its heading for screen readers.
    scrollTo(0, 0)
    document.getElementById('screen-title')?.focus({ preventScroll: true })
  }, [path])
  return (
    <div class="shell">
      <a class="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>{t('skip')}</a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Screen path={path} />
        {/* Calculer renders its own: under the result card, or at the end when there is none. */}
        {tabOf(path) !== 'calculer' && <Disclaimer />}
      </main>
      <NavBar />
    </div>
  )
}
