import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { extractPdfItems, groupLines, parseOrange, parseOrangeItems, type PdfItem } from '../../src/tariffs/parsers/orange'
import { ParseError } from '../../src/tariffs/parsers/common'
import type { Tariffs } from '../../src/tariffs/schema'

const tariffs = (): Tariffs => JSON.parse(readFileSync('tests/fixtures/tarifs.snapshot.json', 'utf8'))
const pdf = () => new Uint8Array(readFileSync('tests/fixtures/orange.pdf'))
const items = () => extractPdfItems(pdf())
const orange = () => tariffs().operators.orange

describe('parseOrange', () => {
  it('fees match tarifs.json', async () => {
    const op = await parseOrange(pdf())
    expect(op.fees).toEqual(orange().fees)
  })
  it('whole operator matches tarifs.json, publishedAt from « manomboka ny 01 Febroary 2025 »', async () => {
    const op = await parseOrange(pdf())
    expect(op.source.publishedAt).toBe('2025-02-01')
    expect(op).toEqual(orange())
  })
  it('accepts a Node Buffer straight from fs.readFileSync', async () => {
    const op = await parseOrange(readFileSync('tests/fixtures/orange.pdf'))
    expect(op).toEqual(orange())
  })
  it('rejects a truncated PDF with ParseError', async () => {
    await expect(parseOrange(pdf().slice(0, 10 * 1024))).rejects.toBeInstanceOf(ParseError)
  })
  it('rejects non-PDF bytes with ParseError', async () => {
    await expect(parseOrange(new TextEncoder().encode('<html></html>'))).rejects.toBeInstanceOf(ParseError)
  })
})

describe('parseOrangeItems', () => {
  const header = (all: PdfItem[], s: string) => all.find((i) => i.str === s && i.y > -10000 + 400)!

  it.each(['IzyCash', '#144#', '@ Appli', 'tambazotra', 'microfinances***', 'Fisintonam-bola'])('missing header « %s » → ParseError', async (h) => {
    const all = await items()
    const target = header(all, h)
    expect(target).toBeDefined()
    expect(() => parseOrangeItems(all.filter((i) => i !== target))).toThrow(ParseError)
  })

  it('maps value cells by header position, not by order', async () => {
    const all = await items()
    // Swap the « autres réseaux » and « microfinances » header labels: the columns must follow the labels.
    const a = header(all, 'tambazotra')
    const b = header(all, 'microfinances***')
    const swapped = all.map((i) => (i === a ? { ...b, x: a.x, width: a.width, y: a.y } : i === b ? { ...a, x: b.x, width: b.width, y: b.y } : i))
    const op = parseOrangeItems(swapped)
    // microfinances column from the official grid (gen-initial-tariffs.mjs)
    expect(op.fees.transfer_other_op!.slice(0, 6).map((t) => 'fee' in t && t.fee)).toEqual([120, 120, 250, 400, 400, 880])
    expect(op.fees.transfer_other_op).toHaveLength(19)
  })

  it('tolerates small y jitter within a tier line', async () => {
    const all = await items()
    const jittered = all.map((i, n) => ({ ...i, y: i.y + ((n % 3) - 1) * 0.9 }))
    expect(parseOrangeItems(jittered)).toEqual(orange())
  })

  it('throws ParseError on non-contiguous bounds', async () => {
    const all = await items()
    const altered = all.map((i) => (i.str === '1 001' ? { ...i, str: '1 002' } : i))
    expect(() => parseOrangeItems(altered)).toThrow(ParseError)
  })

  it('throws ParseError on a garbage value cell', async () => {
    const all = await items()
    const altered = all.map((i) => (i.str === '880' ? { ...i, str: '8,80' } : i))
    expect(() => parseOrangeItems(altered)).toThrow(ParseError)
  })
})

describe('groupLines', () => {
  it('clusters items within ±2 on y, even across rounding boundaries', () => {
    const it = (x: number, y: number, str: string): PdfItem => ({ x, y, width: 5, str })
    const lines = groupLines([it(10, 100.6, 'a'), it(20, 99.4, 'b'), it(5, 95, 'c')])
    expect(lines.map((l) => l.map((i) => i.str))).toEqual([['a', 'b'], ['c']])
  })
})
