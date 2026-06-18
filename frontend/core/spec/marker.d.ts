import type { MARKER } from '~/const/marker'
import type { TIconName } from '~/widgets/IconHub/icons'
import type { TMarkerIconProvider } from '~/widgets/IconHub/sprite'
import type { TDevLogo } from '~/widgets/MarkerPicker/constant/dev_logo'

export type TMarkerIconValue = {
  type: typeof MARKER.ICON
  provider: TMarkerIconProvider
  name: TIconName | TDevLogo
  // Provider single-file SVG path for mask render mode.
  src: string
}

export type TMarkerEmojiValue = {
  type: typeof MARKER.EMOJI
  unified: string
}

export type TMarkerValue = TMarkerIconValue | TMarkerEmojiValue
