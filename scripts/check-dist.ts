// Build verification: the public bundle must not reveal the admin page's name.
// Files belonging to the admin itself (zadmin.html, zadmin/ or zadmin-* chunks) are exempt.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const isAdminFile = (rel: string) => /(^|\/)zadmin([./-]|$)/.test(rel)

export function findLeaks(dir: string, needle = 'zadmin'): string[] {
  const leaks: string[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name)
      const rel = relative(dir, full).split('\\').join('/')
      if (statSync(full).isDirectory()) { if (!isAdminFile(rel)) walk(full); continue }
      if (isAdminFile(rel)) continue
      if (readFileSync(full).includes(needle)) leaks.push(rel)
    }
  }
  walk(dir)
  return leaks
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const leaks = findLeaks(process.argv[2] ?? 'dist')
  if (leaks.length) {
    console.error(`check-dist: "zadmin" found in public files: ${leaks.join(', ')}`)
    process.exit(1)
  }
  console.log('check-dist: OK')
}
