import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ParseError, parseAmount, rowsToTable } from '../../src/tariffs/parsers/common'
import { parseAirtel } from '../../src/tariffs/parsers/airtel'
import { parseMvola } from '../../src/tariffs/parsers/mvola'
import { parseGenericTables } from '../../src/tariffs/parsers/generic'
import { TariffsSchema, type Tariffs } from '../../src/tariffs/schema'

const tariffs = (): Tariffs => JSON.parse(readFileSync('public/tarifs.json', 'utf8'))
const airtelHtml = readFileSync('tests/fixtures/airtel.html', 'utf8')
const mvolaHtml = readFileSync('tests/fixtures/mvola.html', 'utf8')

describe('parseAmount', () => {
  it('parses grouped digits, currency suffix, free and dashes', () => {
    expect(parseAmount('1 000')).toBe(1000)
    expect(parseAmount('1 000 Ar')).toBe(1000)
    expect(parseAmount('Gratuit')).toBe(0)
    expect(parseAmount('GRATUIT')).toBe(0)
    expect(parseAmount('–')).toBeNull()
    expect(parseAmount('-')).toBeNull()
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('  ')).toBeNull()
  })
})

describe('rowsToTable', () => {
  it('skips null cells', () => {
    expect(rowsToTable([
      { min: 1, max: 10, cell: '5' },
      { min: 11, max: 20, cell: '–' },
      { min: 21, max: 30, cell: 'Gratuit' },
    ])).toEqual([{ min: 1, max: 10, fee: 5 }, { min: 21, max: 30, fee: 0 }])
  })
})

describe('parseAirtel', () => {
  it('matches tarifs.json', () => {
    const op = parseAirtel(airtelHtml)
    expect(op).toEqual(tariffs().operators.airtel)
  })
  it('throws ParseError when an expected column header is missing', () => {
    const broken = airtelHtml.replace('vers les abonnés', 'vers les clients')
    expect(broken).not.toBe(airtelHtml)
    expect(() => parseAirtel(broken)).toThrow(ParseError)
  })
  it('throws ParseError on unrelated HTML', () => {
    expect(() => parseAirtel('<html><body><p>maintenance</p></body></html>')).toThrow(ParseError)
  })
})

describe('parseMvola', () => {
  it('matches tarifs.json', () => {
    const op = parseMvola(mvolaHtml)
    expect(op.fees).toEqual(tariffs().operators.mvola.fees)
    expect(op).toEqual(tariffs().operators.mvola)
  })
  it('reads publishedAt from « au JJ-MM-AAAA »', () => {
    expect(parseMvola(mvolaHtml).source.publishedAt).toBe('2025-02-17')
  })
  it('throws ParseError when an expected column header is missing', () => {
    const broken = mvolaHtml.replace('Auprès d’un Cash Point MVola</', 'Ailleurs</')
    expect(broken).not.toBe(mvolaHtml)
    expect(() => parseMvola(broken)).toThrow(ParseError)
  })
  it('throws ParseError on unrelated HTML', () => {
    expect(() => parseMvola('<html><body></body></html>')).toThrow(ParseError)
  })
  it('parsed operators assemble into a schema-valid Tariffs', () => {
    const t = tariffs()
    const out = { ...t, operators: { ...t.operators, mvola: parseMvola(mvolaHtml), airtel: parseAirtel(airtelHtml) } }
    expect(TariffsSchema.safeParse(out).success).toBe(true)
  })
})

describe('parseGenericTables', () => {
  it('extracts headers and rows from html tables', () => {
    const tables = parseGenericTables('<table><thead><tr><th>A</th><th> B </th></tr></thead><tbody><tr><td>1</td><td>2 000</td></tr></tbody></table>')
    expect(tables).toEqual([{ headers: ['A', 'B'], rows: [['1', '2 000']] }])
  })
  it('uses first row as headers when there is no thead', () => {
    expect(parseGenericTables('<table><tr><td>X</td><td>Y</td></tr><tr><td>a</td><td>b</td></tr></table>'))
      .toEqual([{ headers: ['X', 'Y'], rows: [['a', 'b']] }])
  })
  it('finds the airtel fee table', () => {
    const t = parseGenericTables(airtelHtml)
    expect(t[0].headers[0]).toMatch(/Montant Minimum/)
    expect(t[0].rows).toHaveLength(33)
  })
})
