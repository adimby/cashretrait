import { describe, it, expect } from 'vitest'
import { tariffStatus } from '../../src/ui/state/network'

describe('tariffStatus', () => {
  it('fresh when online and not stale', () => expect(tariffStatus(false, true)).toBe('fresh'))
  it('outdated when online but stale', () => expect(tariffStatus(true, true)).toBe('outdated'))
  it('offline whenever the device is offline', () => {
    expect(tariffStatus(true, false)).toBe('offline')
    expect(tariffStatus(false, false)).toBe('offline') // data served by the SW cache
  })
})
