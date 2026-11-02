// Admin entry (zadmin.html). Never imported by the public app: its chunks are named zadmin-* (vite.config.ts).
import { render } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import '../ui/styles/app.css'
import './admin.css'
import { Icon } from '../ui/components/Icon'
import type { Draft } from './draft'
import { Login } from './Login'
import { Import } from './Import'
import { Preview } from './Preview'
import { S } from './strings'

type Screen =
  | { name: 'login'; notice?: string }
  | { name: 'import' }
  | { name: 'preview'; draft: Draft }
  | { name: 'done'; commitUrl: string }

function Done({ commitUrl, onAgain }: { commitUrl: string; onAgain: () => void }) {
  return (
    <section class="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" tabIndex={-1} class="screen-title adm-done-title"><Icon name="check" size={32} />{S.done.title}</h1>
      <p class="lead">{S.done.lead}</p>
      <a class="btn btn-outline btn-wide adm-link" href={commitUrl} target="_blank" rel="noopener noreferrer">
        <Icon name="external" size={20} />{S.done.commit}
      </a>
      <button type="button" class="btn btn-solid btn-wide" onClick={onAgain}>{S.done.again}</button>
    </section>
  )
}

function Admin() {
  const [screen, setScreen] = useState<Screen>({ name: 'login' })
  const main = useRef<HTMLElement>(null)
  const unauthorized = () => setScreen({ name: 'login', notice: S.login.expired })

  // Each screen change starts at the top with focus on the new title (screen readers announce it).
  useEffect(() => {
    scrollTo(0, 0)
    if (screen.name !== 'login') main.current?.querySelector<HTMLElement>('#screen-title')?.focus()
  }, [screen.name])

  return (
    <div class="shell">
      <header class="appbar">
        <div class="appbar-row">
          <a class="wordmark" href="/">
            <span class="wordmark-cash">Cash</span><span class="wordmark-retrait">Retrait</span>
          </a>
          <span class="appbar-status">{S.appbar}</span>
        </div>
      </header>
      <main ref={main} class="adm-main">
        {screen.name === 'login' && <Login notice={screen.notice} onDone={() => setScreen({ name: 'import' })} />}
        {screen.name === 'import' && <Import onUnauthorized={unauthorized} onDraft={(draft) => setScreen({ name: 'preview', draft })} />}
        {screen.name === 'preview' && (
          <Preview draft={screen.draft} onUnauthorized={unauthorized} onBack={() => setScreen({ name: 'import' })}
            onDone={(commitUrl) => setScreen({ name: 'done', commitUrl })} />
        )}
        {screen.name === 'done' && <Done commitUrl={screen.commitUrl} onAgain={() => setScreen({ name: 'import' })} />}
      </main>
    </div>
  )
}

render(<Admin />, document.getElementById('admin')!)
