import type { NODE_STYLE } from '~/const/node_style'
import type { TIconName } from '~/widgets/IconHub/icons'
import type { TIconProvider } from '~/widgets/IconHub/sprite'
import type { TDevLogo } from '~/widgets/NodeStylePicker/constant/dev_logo'

import type { TColorName } from './color'

export type TNodeStyleIconValue = {
  type: typeof NODE_STYLE.ICON
  provider: TIconProvider
  name: TIconName
  // Provider single-file SVG path for mask render mode.
  src: string
}

export type TNodeStyleEmojiValue = {
  type: typeof NODE_STYLE.EMOJI
  unified: string
}

export type TNodeStyleDevValue = {
  type: typeof NODE_STYLE.DEV
  name: TDevLogo
  // Persisted relative path; render resolves it to the current CDN host.
  src: string
}

export type TNodeStyleColorValue = {
  type: typeof NODE_STYLE.COLOR
  color: TColorName
}

export type TNodeStyleValue =
  | TNodeStyleIconValue
  | TNodeStyleDevValue
  | TNodeStyleEmojiValue
  | TNodeStyleColorValue
