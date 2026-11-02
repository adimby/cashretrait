import { describe, it, expect } from 'vitest'
import { formatAr, formatNumber, formatDate } from '../../src/ui/format'

const norm = (s: string) => s.replace(/[\s  ]/g, ' ')

describe('format', () => {
  it('formatAr(1000000) = 1 000 000 Ar', () => expect(norm(formatAr(1000000))).toBe('1 000 000 Ar'))
  it('small and zero', () => {
    expect(norm(formatAr(0))).toBe('0 Ar')
    expect(norm(formatAr(650))).toBe('650 Ar')
    expect(norm(formatAr(1300))).toBe('1 300 Ar')
  })
  it('negative', () => expect(norm(formatAr(-25000))).toBe('-25 000 Ar'))
  it('uses non-breaking spaces so amounts never wrap', () => expect(formatAr(1000)).not.toMatch(/ /))
  it('rounds to integer ariary', () => expect(norm(formatNumber(1234.6))).toBe('1 235'))
  it('formatDate', () => {
    expect(formatDate('2026-11-02')).toBe('02/11/2026')
    expect(formatDate('2026-11-02T03:00:00Z')).toBe('02/11/2026')
    expect(formatDate('garbage')).toBe('garbage')
  })
})
