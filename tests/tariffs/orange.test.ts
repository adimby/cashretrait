import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseOrange } from '../../src/tariffs/parsers/orange'
import { ParseError } from '../../src/tariffs/parsers/common'
import type { Tariffs } from '../../src/tariffs/schema'

const tariffs = (): Tariffs => JSON.parse(readFileSync('public/tarifs.json', 'utf8'))
const pdf = () => new Uint8Array(readFileSync('tests/fixtures/orange.pdf'))

describe('parseOrange', () => {
  it('fees match tarifs.json', async () => {
    const op = await parseOrange(pdf())
    expect(op.fees).toEqual(tariffs().operators.orange.fees)
  })
  it('whole operator matches tarifs.json, publishedAt from « manomboka ny 01 Febroary 2025 »', async () => {
    const op = await parseOrange(pdf())
    expect(op.source.publishedAt).toBe('2025-02-01')
    expect(op).toEqual(tariffs().operators.orange)
  })
  it('rejects a truncated PDF with ParseError', async () => {
    await expect(parseOrange(pdf().slice(0, 10 * 1024))).rejects.toBeInstanceOf(ParseError)
  })
  it('rejects non-PDF bytes with ParseError', async () => {
    await expect(parseOrange(new TextEncoder().encode('<html></html>'))).rejects.toBeInstanceOf(ParseError)
  })
})
