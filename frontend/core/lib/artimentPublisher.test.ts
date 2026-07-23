import { afterEach, describe, expect, it, vi } from 'vitest'

import { saveDocDraft } from './artimentPublisher'

const input = {
  value: [{ type: 'p', children: [{ text: 'Draft body content' }] }],
  community: 'home',
  id: 'doc-id',
  title: 'Introduction',
  subtitle: 'Intro',
  slug: 'introduction',
}

describe('saveDocDraft', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends Plate value to the same-origin publisher route', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ draft: { docId: 'doc-id', title: 'Introduction' }, ok: true }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveDocDraft(input)).resolves.toEqual({
      docId: 'doc-id',
      title: 'Introduction',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/artiment/publish',
      expect.objectContaining({ method: 'POST' }),
    )
    const request = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({
      action: 'updateDocDraft',
      value: input.value,
      variables: {
        community: 'home',
        id: 'doc-id',
        slug: 'introduction',
        subtitle: 'Intro',
        title: 'Introduction',
      },
    })
  })

  it('surfaces the publisher error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { message: 'Artiment BodyBag requires a verified publisher' }, ok: false },
          { status: 422 },
        ),
      ),
    )

    await expect(saveDocDraft(input)).rejects.toThrow(
      'Artiment BodyBag requires a verified publisher',
    )
  })
})
