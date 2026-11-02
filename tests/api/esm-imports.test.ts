import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)])).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts'))
const relImports = (f: string) => [...readFileSync(f, 'utf8').matchAll(/(?:from|import\()\s*'(\.{1,2}\/[^']+)'/g)].map((m) => m[1])

describe('serverless functions', () => {
  // Vercel runs api/ as native Node ESM (package.json "type": "module"): relative specifiers need an extension.
  it.each([...walk('api'), ...walk('src/tariffs')])('%s: relative imports end in .js', (f) => {
    expect(relImports(f).filter((s) => !s.endsWith('.js'))).toEqual([])
  })
  it('the browser app never imports api/', () => {
    const offenders = walk('src').filter((f) => relImports(f).some((s) => /(^|\/)api\//.test(s)))
    expect(offenders).toEqual([])
  })
})
