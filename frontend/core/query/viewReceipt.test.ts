import {
  clearArticleViewReceipt,
  clearArticleViewReceipts,
  readArticleViewReceipt,
  writeArticleViewReceipt,
} from './viewReceipt'

describe('article view receipts', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('stores and reads an accepted stable event', () => {
    writeArticleViewReceipt('home:POST:42', 'event-1')

    expect(readArticleViewReceipt('home:POST:42')).toMatchObject({
      articleRef: 'home:POST:42',
      viewEventId: 'event-1',
      accepted: true,
    })
  })

  it('clears one receipt without touching another article', () => {
    writeArticleViewReceipt('home:POST:42', 'event-1')
    writeArticleViewReceipt('home:POST:43', 'event-2')

    clearArticleViewReceipt('home:POST:42')

    expect(readArticleViewReceipt('home:POST:42')).toBeNull()
    expect(readArticleViewReceipt('home:POST:43')?.viewEventId).toBe('event-2')
  })

  it('clears all receipts during account cleanup', () => {
    writeArticleViewReceipt('home:POST:42', 'event-1')
    writeArticleViewReceipt('home:POST:43', 'event-2')

    clearArticleViewReceipts()

    expect(readArticleViewReceipt('home:POST:42')).toBeNull()
    expect(readArticleViewReceipt('home:POST:43')).toBeNull()
  })
})
