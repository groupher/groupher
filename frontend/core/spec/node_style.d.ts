import type { NODE_STYLE } from '~/const/node_style'
import type { TIconName, TIconProvider } from '~/widgets/IconHub/icons'

import type { TColorName } from './color'

export type TNodeStyleIconValue = {
  type: typeof NODE_STYLE.ICON
  provider: TIconProvider
  name: TIconName
  src: string
}

export type TNodeStyleEmojiValue = {
  type: typeof NODE_STYLE.EMOJI
  unified: string
}

export type TNodeStyleColorValue = {
  type: typeof NODE_STYLE.COLOR
  color: TColorName
}

export type TNodeStyleValue = TNodeStyleIconValue | TNodeStyleEmojiValue | TNodeStyleColorValue
