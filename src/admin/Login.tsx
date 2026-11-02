import { useEffect, useRef, useState } from 'preact/hooks'
import { login } from './api'
import { S } from './strings'

export function Login({ notice, onDone }: { notice?: string; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  const submit = async (e: Event) => {
    e.preventDefault()
    if (pending || wait > 0 || !password) return
    setPending(true)
    setError(null)
    const r = await login(password)
    setPending(false)
    if (r.ok) return onDone()
    setPassword('')
    if (r.status === 429) setWait(r.retryAfter ?? 30)
    else setError(r.status === 401 ? S.login.wrong : r.status === 503 ? S.login.notConfigured : r.message)
    input.current?.focus()
  }

  const message = wait > 0 ? S.login.wait(wait) : error ?? notice
  return (
    <section class="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" tabIndex={-1} class="screen-title">{S.login.title}</h1>
      <p class="lead">{S.login.lead}</p>
      <form class="adm-form" onSubmit={submit}>
        <label class="adm-field" for="pw">
          <span class="field-label">{S.login.password}</span>
          <input id="pw" ref={input} class="adm-input" type="password" autoComplete="current-password" required
            value={password} onInput={(e) => setPassword(e.currentTarget.value)} aria-describedby="login-msg" />
        </label>
        <p id="login-msg" class={message ? 'notice notice-error' : 'visually-hidden'} role="alert">{message ?? ''}</p>
        <button type="submit" class="btn btn-solid btn-wide" disabled={pending || wait > 0}>
          {pending ? S.login.pending : S.login.submit}
        </button>
      </form>
    </section>
  )
}
