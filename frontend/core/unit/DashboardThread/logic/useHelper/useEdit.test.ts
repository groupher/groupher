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
      textTitle: '#243041',
      textDigest: '#6b7280',
      gaussBlur: 100,
      gaussBlurDark: 100,
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

  it('rolls back theme preset base with the appearance preset draft', () => {
    const { result } = renderHook(() => useEdit())

    result.current.rollbackEdit(FIELD.THEME_PRESET)

    expect(rollbackFields).toHaveBeenCalledWith([
      FIELD.THEME_PRESET,
      FIELD.THEME_PRESET_BASE,
      FIELD.THEME_TOKENS,
      FIELD.TEXT_TITLE,
      FIELD.TEXT_DIGEST,
      FIELD.GAUSS_BLUR,
      FIELD.GAUSS_BLUR_DARK,
    ])
  })
})
