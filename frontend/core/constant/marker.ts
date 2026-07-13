import type { TMarkerValue } from '~/spec'
import { getIconFilePath } from '~/widgets/IconHub/sprite'

import { COLOR, RAINBOW_COLOR_HEX, RAINBOW_SOFT_COLOR_HEX } from './colors'
import THEME from './theme'

export const MARKER = {
  ICON: 'ICON',
  EMOJI: 'EMOJI',
} as const

export const DEFAULT_PAGE_MARKER: TMarkerValue = {
  type: MARKER.ICON,
  provider: 'phosphor',
  name: 'file-text',
  src: getIconFilePath('phosphor', 'file-text'),
}

export const DEFAULT_LINK_MARKER: TMarkerValue = {
  type: MARKER.ICON,
  provider: 'lucide',
  name: 'external-link',
  src: getIconFilePath('lucide', 'external-link'),
}

export const DEFAULT_PIN_MARKER: TMarkerValue = {
  ...DEFAULT_LINK_MARKER,
  appearance: {
    [THEME.LIGHT]: {
      color: RAINBOW_COLOR_HEX[THEME.LIGHT][COLOR.BLUE],
      bg: RAINBOW_SOFT_COLOR_HEX[THEME.LIGHT][COLOR.BLUE],
    },
    [THEME.DARK]: {
      color: RAINBOW_COLOR_HEX[THEME.DARK][COLOR.BLUE],
      bg: RAINBOW_SOFT_COLOR_HEX[THEME.DARK][COLOR.BLUE],
    },
  },
}

export const DEFAULT_GROUP_MARKER: TMarkerValue = {
  type: MARKER.ICON,
  provider: 'lucide',
  name: 'folder',
  src: getIconFilePath('lucide', 'folder'),
}
