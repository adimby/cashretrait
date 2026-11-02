import { load } from 'cheerio'

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

export type GenericTable = { headers: string[]; rows: string[][] }

/**
 * Extract every table as header labels + body rows of cell text.
 * HTML: <table> elements (headers from <thead>, else first row).
 * Plain text: one table, cells split on tabs, pipes or runs of 2+ spaces.
 */
export function parseGenericTables(htmlOrText: string): GenericTable[] {
  if (!/<table[\s>]/i.test(htmlOrText)) return textTable(htmlOrText)
  const $ = load(htmlOrText)
  const out: GenericTable[] = []
  $('table').each((_, table) => {
    const cells = (tr: Parameters<typeof $>[0]) => $(tr).children('th,td').map((_, c) => clean($(c).text())).get()
    const head = $(table).find('thead tr').first()
    let rows = $(table).find('tr').filter((_, tr) => $(tr).closest('thead').length === 0).get().map(cells)
    let headers: string[]
    if (head.length) headers = cells(head.get(0)!)
    else {
      headers = rows[0] ?? []
      rows = rows.slice(1)
    }
    out.push({ headers, rows: rows.filter((r) => r.some((c) => c !== '')) })
  })
  return out
}

function textTable(text: string): GenericTable[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const split = (l: string) => l.split(/\t|\s*\|\s*|\s{2,}/).map(clean).filter((c) => c !== '')
  const rows = lines.map(split).filter((r) => r.length > 1)
  if (!rows.length) return []
  return [{ headers: rows[0], rows: rows.slice(1) }]
}
