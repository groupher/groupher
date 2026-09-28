import {
  clearArticleViewAck,
  clearArticleViewAcks,
  readArticleViewAck,
  writeArticleViewAck,
} from './viewAck'

describe('article view acknowledgements', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('stores and reads a committed acknowledgement without an event id', () => {
    writeArticleViewAck('home:POST:42')

    expect(readArticleViewAck('home:POST:42')).toMatchObject({
      articleKey: 'home:POST:42',
    })
    expect(readArticleViewAck('home:POST:42')).not.toHaveProperty('eventId')
  })

  it('clears one acknowledgement without touching another article', () => {
    writeArticleViewAck('home:POST:42')
    writeArticleViewAck('home:POST:43')

    clearArticleViewAck('home:POST:42')

    expect(readArticleViewAck('home:POST:42')).toBeNull()
    expect(readArticleViewAck('home:POST:43')).not.toBeNull()
  })

  it('clears all acknowledgements during account cleanup', () => {
    writeArticleViewAck('home:POST:42')
    writeArticleViewAck('home:POST:43')

    clearArticleViewAcks()

    expect(readArticleViewAck('home:POST:42')).toBeNull()
    expect(readArticleViewAck('home:POST:43')).toBeNull()
  })
})
