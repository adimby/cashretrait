import { useState } from 'preact/hooks'
import { OPERATORS, type OperatorId } from '../tariffs/schema'
import { loadDeployed, parseFile, parseUrl, type ApiError } from './api'
import type { Draft } from './draft'
import { OPERATOR_NAMES, S } from './strings'

type Mode = 'file' | 'url' | 'manual'
const MODES: Mode[] = ['file', 'url', 'manual']

function Segments<T extends string>({ name, legend, options, value, label, onChange }: {
  name: string; legend: string; options: readonly T[]; value: T; label: (o: T) => string; onChange: (o: T) => void
}) {
  return (
    <fieldset class="field">
      <legend class="field-label">{legend}</legend>
      <div class="segmented" role="radiogroup">
        {options.map((o) => (
          <label key={o} class="segment">
            <input type="radio" name={name} value={o} checked={o === value} onChange={() => onChange(o)} />
            <span>{label(o)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Import({ onDraft, onUnauthorized }: { onDraft: (d: Draft) => void; onUnauthorized: () => void }) {
  const [operator, setOperator] = useState<OperatorId>('mvola')
  const [mode, setMode] = useState<Mode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fail = (r: ApiError) => {
    if (r.status === 401) return onUnauthorized()
    setError(r.message)
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    if (pending) return
    setError(null)
    if (mode === 'file' && !file) return setError(S.import.noFile)
    if (mode === 'url' && !url.trim()) return setError(S.import.noUrl)
    setPending(true)
    try {
      const at = new Date()
      if (mode === 'manual') {
        const d = await loadDeployed()
        if (!d) return setError(S.import.loadFailed)
        return onDraft({ operator, current: d.current, edited: structuredClone(d.current.operators[operator]), baseSha: d.baseSha, origin: 'manual', at })
      }
      const r = mode === 'file' ? await parseFile(operator, file!) : await parseUrl(operator, url.trim())
      if (!r.ok) return fail(r)
      const p = r.data
      if ('operator' in p) {
        onDraft({ operator, current: p.current, edited: p.operator, baseSha: p.baseSha, origin: 'parse', at })
      } else {
        // Fallback: start from the published grid and let the admin map the raw tables.
        onDraft({ operator, current: p.current, edited: structuredClone(p.current.operators[operator]), baseSha: p.baseSha,
          origin: 'generic', parserError: p.error, generic: p.generic, at })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <section class="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" tabIndex={-1} class="screen-title">{S.import.title}</h1>
      <form class="adm-form" onSubmit={submit}>
        <Segments name="op" legend={S.import.operator} options={OPERATORS} value={operator} label={(o) => OPERATOR_NAMES[o]} onChange={setOperator} />
        <Segments name="mode" legend={S.import.mode} options={MODES} value={mode} label={(m) => S.import.modes[m]} onChange={(m) => { setMode(m); setError(null) }} />

        {mode === 'file' && (
          <label class="adm-field" for="src-file">
            <span class="field-label">{S.import.file}</span>
            <span class="field-help" id="src-file-help">{S.import.fileHelp}</span>
            <input id="src-file" class="adm-file" type="file" accept=".pdf,.html,.htm,application/pdf,text/html"
              aria-describedby="src-file-help" onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} />
          </label>
        )}
        {mode === 'url' && (
          <label class="adm-field" for="src-url">
            <span class="field-label">{S.import.url}</span>
            <span class="field-help" id="src-url-help">{S.import.urlHelp}</span>
            <input id="src-url" class="adm-input" type="url" inputMode="url" autoComplete="off" placeholder="https://"
              aria-describedby="src-url-help" value={url} onInput={(e) => setUrl(e.currentTarget.value)} />
          </label>
        )}
        {mode === 'manual' && <p class="field-help">{S.import.manualHelp}</p>}

        <p class={error ? 'notice notice-error' : 'visually-hidden'} role="alert">{error ?? ''}</p>
        <button type="submit" class="btn btn-solid btn-wide" disabled={pending} aria-busy={pending}>
          {pending ? S.import.pending : S.import.submit[mode]}
        </button>
      </form>
    </section>
  )
}
