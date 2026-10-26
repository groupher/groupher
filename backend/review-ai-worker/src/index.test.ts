import { describe, expect, it, vi } from 'vitest'

import worker, { type TReviewWorkerEnv } from './index'

const makeEnv = (choice: 'pass' | 'violation' | 'review' = 'pass') => {
  const run = vi.fn().mockResolvedValue({
    answers: {
      status: { choice },
      category: { choice: choice === 'violation' ? 'harassment' : 'none' },
    },
  })
  const env = {
    AI: { run } as TReviewWorkerEnv['AI'],
    REVIEW_BOT_TOKEN: 'worker-test-token',
  }
  return { env, run }
}

const request = (body: unknown, token = 'worker-test-token'): Request =>
  new Request('https://review-worker.test/v1/judge', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

const input = {
  model: 'gpt-5-mini',
  systemPrompt: 'Be fair and consistent.',
  prompt: 'No personal attacks.',
  banWords: ['junk'],
  text: { title: 'A discussion', body: 'This product update is late.' },
  images: [],
  requiredModalities: ['text'],
}

describe('review AI Worker', () => {
  it('rejects requests without the configured bearer token', async () => {
    const { env, run } = makeEnv()
    const response = await worker.fetch(request(input, 'wrong-token'), env)

    expect(response.status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it('maps a Clef pass decision to the existing judge response contract', async () => {
    const { env, run } = makeEnv('pass')
    const response = await worker.fetch(request(input), env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'clear',
      susNotes: [],
      coverage: { text: 'complete', image: 'complete' },
    })
    expect(run).toHaveBeenCalledWith(
      '@cf/cloudflare/clef-flash',
      expect.objectContaining({
        model: 'clef-flash',
        questions: expect.objectContaining({ status: expect.objectContaining({ type: 'choice' }) }),
      }),
    )
  })

  it('maps a violation decision and evidence to the judge response contract', async () => {
    const { env } = makeEnv('violation')
    const response = await worker.fetch(request(input), env)

    expect(await response.json()).toMatchObject({
      status: 'suspect',
      susNotes: [
        { type: 'harassment', evidence: '模型未返回精确原文片段；请管理员结合原文定位。' },
      ],
    })
  })

  it('fails closed when the request requires image review', async () => {
    const { env, run } = makeEnv()
    const response = await worker.fetch(
      request({
        ...input,
        requiredModalities: ['text', 'image'],
        images: [{ signedReadUrl: 'https://assets.test/file' }],
      }),
      env,
    )

    expect(response.status).toBe(422)
    expect(run).not.toHaveBeenCalled()
  })

  it('rejects content that could exceed Clef-flash context instead of allowing truncation', async () => {
    const { env, run } = makeEnv()
    const response = await worker.fetch(
      request({ ...input, text: { ...input.text, body: '中文'.repeat(9_000) } }),
      env,
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: 'content_exceeds_model_context' })
    expect(run).not.toHaveBeenCalled()
  })
})
