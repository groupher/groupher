import type { MARKER } from '~/const/marker'
import type { TIconName } from '~/widgets/IconHub/icons'
import type { TMarkerIconProvider } from '~/widgets/IconHub/sprite'
import type { TDevLogo } from '~/widgets/MarkerPicker/constant/dev_logo'

export type TMarkerThemeAppearance = {
  color?: string
  bg?: string
}

export type TMarkerAppearance = {
  light: TMarkerThemeAppearance
  dark: TMarkerThemeAppearance
}

export type TMarkerBgAppearance = {
  light: Pick<TMarkerThemeAppearance, 'bg'>
  dark: Pick<TMarkerThemeAppearance, 'bg'>
}

export type TMarkerIconValue = {
  type: typeof MARKER.ICON
  provider: TMarkerIconProvider
  name: TIconName | TDevLogo
  // Provider single-file SVG path for mask render mode.
  src: string
  appearance?: TMarkerAppearance
}

export type TMarkerEmojiValue = {
  type: typeof MARKER.EMOJI
  unified: string
  appearance?: TMarkerBgAppearance
}

export type TMarkerValue = TMarkerIconValue | TMarkerEmojiValue
