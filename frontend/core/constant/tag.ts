import type { TMarkerValue } from '~/spec'
import { getIconFilePath } from '~/widgets/IconHub/sprite'

import { MARKER } from './marker'

export const DEFAULT_TAG_MARKER = {
  type: MARKER.ICON,
  provider: 'lucide',
  name: 'tag',
  src: getIconFilePath('lucide', 'tag'),
} satisfies TMarkerValue
