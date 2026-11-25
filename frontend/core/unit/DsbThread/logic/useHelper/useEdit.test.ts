import { renderHook } from '@testing-library/react'

import { FIELD } from '../../constant'
import useEdit from './useEdit'

const rollback = vi.fn()
const commit = vi.fn()
const edit = vi.fn()

vi.mock('~/stores/dsbShell/hooks', () => ({
  default: () => ({
    original: {
      themePreset: 'DEFAULT',
      themePresetBase: 'DEFAULT',
      themeTokens: {},
    },
    rollback,
    edit,
    nameAlias: [],
  }),
}))

vi.mock('~/stores/dsbShell/editor', () => ({
  useAliasEditor: () => ({
    editingAlias: { slug: '' },
    reset: commit,
    setEditingAlias: commit,
  }),
}))

vi.mock('~/query/mutation/useDsbFieldSave', () => ({
  default: () => ({
    mutation: vi.fn(),
    isPending: false,
    error: null,
  }),
}))

describe('useEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to single-field rollback for store fields', () => {
    const { result } = renderHook(() => useEdit())

    result.current.rollbackEdit(FIELD.THEME_PRESET)

    expect(rollback).toHaveBeenCalledWith([FIELD.THEME_PRESET])
  })
})
