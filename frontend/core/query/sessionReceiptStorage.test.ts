import {
  clearSessionReceipts,
  listSessionReceipts,
  readSessionReceipt,
  writeSessionReceipt,
} from './sessionReceiptStorage'

type TTestReceipt = {
  schemaVersion: 2
  value: string
  expiresAt: number
}

const prefix = 'test:receipt:'
const validReceipt = (receipt: TTestReceipt): boolean => typeof receipt.value === 'string'

describe('session receipt storage', () => {
  beforeEach(() => window.sessionStorage.clear())

  it.each([
    ['malformed JSON', '{'],
    [
      'an old schema',
      JSON.stringify({ schemaVersion: 1, value: 'old', expiresAt: Date.now() + 1_000 }),
    ],
    [
      'an expired receipt',
      JSON.stringify({ schemaVersion: 2, value: 'old', expiresAt: Date.now() - 1 }),
    ],
  ])('removes %s while reading', (_label, raw) => {
    const key = `${prefix}one`
    window.sessionStorage.setItem(key, raw)

    expect(readSessionReceipt<TTestReceipt>(key, 2, validReceipt)).toBeNull()
    expect(window.sessionStorage.getItem(key)).toBeNull()
  })

  it('lists only valid receipts and prunes invalid siblings', () => {
    writeSessionReceipt(`${prefix}one`, {
      schemaVersion: 2,
      value: 'one',
      expiresAt: Date.now() + 1_000,
    })
    window.sessionStorage.setItem(
      `${prefix}old`,
      JSON.stringify({ schemaVersion: 1, value: 'old', expiresAt: Date.now() + 1_000 }),
    )

    expect(listSessionReceipts<TTestReceipt>(prefix, 2, validReceipt)).toMatchObject([
      { key: `${prefix}one`, receipt: { value: 'one' } },
    ])
    expect(window.sessionStorage.getItem(`${prefix}old`)).toBeNull()
  })

  it('clears one namespace without touching unrelated storage', () => {
    window.sessionStorage.setItem(`${prefix}one`, 'value')
    window.sessionStorage.setItem('test:other', 'value')

    clearSessionReceipts(prefix)

    expect(window.sessionStorage.getItem(`${prefix}one`)).toBeNull()
    expect(window.sessionStorage.getItem('test:other')).toBe('value')
  })
})
