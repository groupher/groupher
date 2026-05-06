import { renderHook } from '@testing-library/react'

import { COMMUNITY_LAYOUT } from '~/const/layout'

import { FIELD } from '../constant'
import useCommunityLayout from './useCommunityLayout'

const isChanged = vi.fn()
const edit = vi.fn()
const rollbackEdit = vi.fn()

vi.mock('~/stores/dashboard/hooks', () => ({
  default: () => ({
    communityLayout: COMMUNITY_LAYOUT.CLASSIC,
    saving: false,
  }),
}))

vi.mock('./useHelper', () => ({
  default: () => ({
    isChanged,
    edit,
    rollbackEdit,
  }),
}))

describe('useCommunityLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rolls back nav active layout draft before editing community layout', () => {
    isChanged.mockImplementation((field: string) => field === FIELD.NAV_ACTIVE_LAYOUT)

    const { result } = renderHook(() => useCommunityLayout())

    result.current.edit(COMMUNITY_LAYOUT.HERO, FIELD.COMMUNITY_LAYOUT)

    expect(rollbackEdit).toHaveBeenCalledWith(FIELD.NAV_ACTIVE_LAYOUT)
    expect(edit).toHaveBeenCalledWith(COMMUNITY_LAYOUT.HERO, FIELD.COMMUNITY_LAYOUT)
  })

  it('does not roll back nav active layout when it is not dirty', () => {
    isChanged.mockReturnValue(false)

    const { result } = renderHook(() => useCommunityLayout())

    result.current.edit(COMMUNITY_LAYOUT.SIDEBAR, FIELD.COMMUNITY_LAYOUT)

    expect(rollbackEdit).not.toHaveBeenCalled()
    expect(edit).toHaveBeenCalledWith(COMMUNITY_LAYOUT.SIDEBAR, FIELD.COMMUNITY_LAYOUT)
  })
})
