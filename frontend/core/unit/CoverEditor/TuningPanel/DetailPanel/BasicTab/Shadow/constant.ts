import type { CSSProperties } from 'react'

import { COVER_SHADOW_COLOR_MODE, COVER_SHADOW_PRESET } from '../../../../constant'
import type { TCoverShadowColorMode, TCoverShadowPreset } from '../../../../spec'

type TShadowPresetOption = {
  label: string
  value: TCoverShadowPreset
}

type TShadowColorOption = {
  label: string
  value: TCoverShadowColorMode
}

export type TShadowPanelStyle = CSSProperties & {
  '--shadow-preview'?: string
}

export const PRESET_OPTIONS: TShadowPresetOption[] = [
  { label: 'None', value: COVER_SHADOW_PRESET.NONE },
  { label: 'XS', value: COVER_SHADOW_PRESET.XSMALL },
  { label: 'S', value: COVER_SHADOW_PRESET.SMALL },
  { label: 'M', value: COVER_SHADOW_PRESET.MEDIUM },
  { label: 'L', value: COVER_SHADOW_PRESET.LARGE },
  { label: 'XL', value: COVER_SHADOW_PRESET.XLARGE },
  { label: 'Custom', value: COVER_SHADOW_PRESET.CUSTOM },
]

export const COLOR_OPTIONS: TShadowColorOption[] = [
  { label: 'Black', value: COVER_SHADOW_COLOR_MODE.BLACK },
  { label: 'White', value: COVER_SHADOW_COLOR_MODE.WHITE },
  { label: 'Color', value: COVER_SHADOW_COLOR_MODE.COLOR },
  { label: 'Rainbow', value: COVER_SHADOW_COLOR_MODE.RAINBOW },
]

export const CHECKER_BG = [
  'bg-white',
  '[background-image:linear-gradient(45deg,rgba(0,0,0,0.06)_25%,transparent_25%),linear-gradient(-45deg,rgba(0,0,0,0.06)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(0,0,0,0.06)_75%),linear-gradient(-45deg,transparent_75%,rgba(0,0,0,0.06)_75%)]',
  '[background-position:0_0,0_4px,4px_-4px,-4px_0px]',
  '[background-size:8px_8px]',
].join(' ')
