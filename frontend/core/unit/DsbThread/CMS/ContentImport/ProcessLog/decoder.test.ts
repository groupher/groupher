import { describe, expect, it } from 'vitest'

import { decodeImportProcess } from './decoder'

describe('decodeImportProcess', () => {
  it('normalizes GraphQL enums and bounds recentBatch', () => {
    const process = decodeImportProcess({
      progress: { completed: 2, total: 8, unit: 'DOCUMENT' },
      recentBatch: Array.from({ length: 7 }, (_, index) => ({
        label: `docs/${index}.md`,
        ref: `doc-${index}`,
        state: index === 0 ? 'SKIPPED' : 'COMPLETED',
      })),
      stage: 'PREPARING',
      state: 'RUNNING',
      updatedAt: '2026-07-22T08:00:00.000Z',
    })

    expect(process).toMatchObject({
      progress: { completed: 2, total: 8, unit: 'document' },
      stage: 'preparing',
      state: 'running',
    })
    expect(process.recentBatch).toHaveLength(5)
    expect(process.recentBatch[0]?.state).toBe('skipped')
  })
})
