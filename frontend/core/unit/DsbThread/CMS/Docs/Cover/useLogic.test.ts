import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TDocCoverPinnedDocAppearance } from '~/unit/DocCovers/spec'

import DashboardSchema from '../../../schema/docs'
import useLogic from './useLogic'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('~/graphql/client', () => ({ browserQuery: mocks.mutate }))

vi.mock('@tanstack/react-query', async () => ({
  ...(await vi.importActual('@tanstack/react-query')),
  useQuery: () => ({ data: null, refetch: mocks.reload }),
}))

vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/stores/dsb/hooks', () => ({
  default: () => ({ docCoverLayout: 'OUTLINE_COLUMNS' }),
}))

describe('docs cover appearance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mutate.mockResolvedValue(undefined)
  })

  it('serializes appearance for the Json scalar mutation variable', async () => {
    const appearance: TDocCoverPinnedDocAppearance = { dark: {}, light: {} }
    const { result } = renderHook(() => useLogic())

    await act(() => result.current.updateAppearance('node-1', appearance))

    expect(mocks.mutate).toHaveBeenCalledWith(DashboardSchema.updatePinnedDocAppearance, {
      appearance: JSON.stringify(appearance),
      community: 'home',
      nodeId: 'node-1',
    })
    expect(mocks.reload).toHaveBeenCalledOnce()
  })
})
