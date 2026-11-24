import { afterEach, describe, expect, it, vi } from 'vitest'

import { saveDocWorkingCopy } from './artimentPublisher'

const input = {
  value: [{ type: 'p', children: [{ text: 'Draft body content' }] }],
  community: 'home',
  articleId: 'doc-id',
  workingCopyId: 'work-id',
  title: 'Introduction',
  subtitle: 'Intro',
  slug: 'introduction',
  revision: 3,
  commandId: '00000000-0000-4000-8000-000000000001',
}

describe('saveDocWorkingCopy', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends Plate value to the same-origin publisher route', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ result: { docId: 'doc-id', title: 'Introduction' }, ok: true }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveDocWorkingCopy(input)).resolves.toEqual({
      docId: 'doc-id',
      title: 'Introduction',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/content/publish',
      expect.objectContaining({ method: 'POST' }),
    )
    const request = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({
      action: 'article.working_copy.save',
      target: { community: 'home', articleId: 'doc-id', workingCopyId: 'work-id' },
      payload: {
        content: { format: 'plate', value: input.value },
        slug: 'introduction',
        subtitle: 'Intro',
        title: 'Introduction',
      },
      revision: 3,
      commandId: expect.any(String),
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

    await expect(saveDocWorkingCopy(input)).rejects.toMatchObject({
      code: 'publisher_failure',
      message: 'Artiment BodyBag requires a verified publisher',
      status: 422,
    })
  })
})
