import { describe, expect, it } from 'vitest'

import { titleSlugify } from '~/utils/server/slugify-route'

const post = async (body: Record<string, unknown>) => {
  const response = await titleSlugify(
    new Request('http://localhost/api/utils/slugify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )

  return {
    response,
    json: await response.json(),
  }
}

describe('/api/utils/slugify', () => {
  it('rejects empty input', async () => {
    const { response, json } = await post({ value: '   ' })

    expect(response.status).toBe(400)
    expect(json).toEqual({ ok: false, error: 'value is required' })
  })

  it('slugifies latin input', async () => {
    const { response, json } = await post({ value: 'Hello, Next.js 16' })

    expect(response.status).toBe(200)
    expect(json).toEqual({ ok: true, slug: 'hello-next-js-16' })
  })

  it('slugifies latin input with diacritics', async () => {
    const { json } = await post({ value: 'Café Über uns' })

    expect(json.slug).toBe('cafe-uber-uns')
  })

  it('slugifies han input to pinyin', async () => {
    const { json } = await post({ value: '中文教程' })

    expect(json.slug).toBe('zhong-wen-jiao-cheng')
  })

  it('slugifies mixed latin and han input', async () => {
    const { json } = await post({ value: 'React经验分享 v2' })

    expect(json.slug).toBe('react-jing-yan-fen-xiang-v2')
  })

  it('uses a valid fallback when no safe slug can be generated', async () => {
    const { json } = await post({ value: 'と', fallback: 'tag' })

    expect(json.slug).toBe('tag')
  })
})
