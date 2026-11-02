import { describe, it, expect } from 'vitest'
import { parseHistory } from '../../src/ui/components/HistoryList'

const ch = { operator: 'mvola', operation: 'withdrawal', min: 1, max: 5000, before: 100, after: 150 }

describe('parseHistory', () => {
  it('missing or empty history → []', () => {
    expect(parseHistory(null)).toEqual([])
    expect(parseHistory([])).toEqual([])
    expect(parseHistory({ nope: 1 })).toEqual([])
  })
  it('keeps well-formed changes, newest first', () => {
    const h = parseHistory([
      { date: '2026-01-01T00:00:00Z', changes: [ch] },
      { date: '2026-03-01T00:00:00Z', changes: [{ ...ch, before: null }, { ...ch, operator: 'x' }] },
      { date: 'bad', changes: [ch] },
      { date: '2026-02-01T00:00:00Z', changes: [] },
    ])
    expect(h.map((e) => e.date)).toEqual(['2026-03-01T00:00:00Z', '2026-01-01T00:00:00Z'])
    expect(h[0].changes).toHaveLength(1)
  })
})
