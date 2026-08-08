import { describe, expect, it, vi } from 'vitest'

import type { PressDatabase } from './db/client'
import { classifyBot, classifyUa, hashClientIp, persistMetric } from './metrics'

describe('machine traffic classification', () => {
  it('classifies search and AI crawlers before the generic isbot fallback', () => {
    expect(classifyBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe('googlebot')
    expect(classifyBot('Mozilla/5.0; OAI-SearchBot/1.0')).toBe('openai')
    expect(classifyBot('ClaudeBot/1.0')).toBe('anthropic')
    expect(classifyBot('curl/8.0')).toBe('others')
  })

  it('keeps UA families bounded and hashes IP only with a salt', () => {
    expect(classifyUa('curl/8.0')).toBe('curl')
    expect(hashClientIp('127.0.0.1', 'test-salt')).toHaveLength(24)
    expect(hashClientIp('127.0.0.1', undefined)).toBeUndefined()
  })

  it('writes one raw event and its hourly rollup through the Press ORM boundary', async () => {
    const values = vi.fn(async () => undefined)
    const execute = vi.fn(async () => undefined)
    const database = {
      insert: vi.fn(() => ({ values })),
      execute,
    } as unknown as PressDatabase
    const event = {
      requestTimeUtc: new Date('2026-08-08T12:34:56Z'),
      communityRef: 'home',
      outputKind: 'markdown' as const,
      statusCode: 200,
      cacheStatus: 'miss' as const,
      durationMs: 20,
      originDurationMs: 12,
      renderDurationMs: 2,
      responseBytes: 128,
      botFamily: 'openai' as const,
      requestId: 'request-1',
    }

    await persistMetric(database, event)

    expect(values).toHaveBeenCalledWith(event)
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
