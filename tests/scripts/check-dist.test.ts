import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findLeaks } from '../../scripts/check-dist'

function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'cr-dist-'))
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true })
    writeFileSync(join(dir, p), c)
  }
  return dir
}

describe('check-dist', () => {
  it('flags public files mentioning the admin page', () => {
    const dir = fixture({ 'sw.js': 'denylist:[/^\\/zadmin/]', 'assets/index-1.js': 'ok', 'index.html': '<p>' })
    expect(findLeaks(dir)).toEqual(['sw.js'])
  })
  it('ignores the admin page and its own chunks', () => {
    const dir = fixture({ 'zadmin.html': 'zadmin', 'assets/zadmin-abc.js': 'zadmin', 'zadmin/x.js': 'zadmin', 'sw.js': 'clean' })
    expect(findLeaks(dir)).toEqual([])
  })
  it.runIf(existsSync('dist/sw.js'))('current dist/ has no leak', () => {
    expect(findLeaks('dist')).toEqual([])
  })
})
