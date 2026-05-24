import { renderHook } from '@testing-library/react'

import { FIELD } from '../../constant'
import useEdit from './useEdit'

const rollbackFields = vi.fn()
const commit = vi.fn()
const editField = vi.fn()

vi.mock('~/stores/dashboard/hooks', () => ({
  default: () => ({
    original: {
      themePreset: 'DEFAULT',
      themePresetBase: 'DEFAULT',
      themeTokens: {},
    },
    rollbackFields,
    commit,
    editField,
    nameAlias: [],
    editingAlias: { slug: '' },
  }),
}))

vi.mock('../useMutation', () => ({
  default: () => ({
    mutation: vi.fn(),
  }),
}))

describe('useEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to single-field rollback for store fields', () => {
    const { result } = renderHook(() => useEdit())

    result.current.rollbackEdit(FIELD.THEME_PRESET)

    expect(rollbackFields).toHaveBeenCalledWith([FIELD.THEME_PRESET])
  })
})
