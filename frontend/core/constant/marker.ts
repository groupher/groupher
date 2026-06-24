import type { TMarkerValue } from '~/spec'
import { getIconFilePath } from '~/widgets/IconHub/sprite'

export const MARKER = {
  ICON: 'ICON',
  EMOJI: 'EMOJI',
} as const

export const DEFAULT_PAGE_MARKER: TMarkerValue = {
  type: MARKER.ICON,
  provider: 'lucide',
  name: 'file-text',
  src: getIconFilePath('lucide', 'file-text'),
}

export const DEFAULT_LINK_MARKER: TMarkerValue = {
  type: MARKER.ICON,
  provider: 'lucide',
  name: 'external-link',
  src: getIconFilePath('lucide', 'external-link'),
}

export const DEFAULT_GROUP_MARKER: TMarkerValue = {
  type: MARKER.ICON,
  provider: 'lucide',
  name: 'folder',
  src: getIconFilePath('lucide', 'folder'),
}
