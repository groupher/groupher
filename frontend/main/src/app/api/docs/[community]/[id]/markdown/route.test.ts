import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDoc } from '~/app/ssr'

import { GET } from './route'

vi.mock('~/app/ssr', () => ({
  getDoc: vi.fn(),
}))

const getDocMock = vi.mocked(getDoc)
const context = {
  params: Promise.resolve({ community: 'groupher', id: '42' }),
}

describe('main doc markdown route', () => {
  beforeEach(() => {
    getDocMock.mockReset()
  })

  it('returns the canonical document markdown', async () => {
    getDocMock.mockResolvedValue({
      title: 'Getting started',
      document: { markdown: '# Hello\n\nGroupher docs.' },
    })

    const response = await GET(new Request('http://localhost'), context)

    expect(getDocMock).toHaveBeenCalledWith('groupher', '42')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('content-disposition')).toBe('inline')
    expect(await response.text()).toBe('# Hello\n\nGroupher docs.')
  })

  it('returns 404 when the public document cannot be loaded', async () => {
    getDocMock.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost'), context)

    expect(response.status).toBe(404)
  })
})
