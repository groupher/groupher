import type { TIconName, TIconProvider } from '~/widgets/IconHub/icons'

export type TNodeStyleIconValue = {
  type: 'icon'
  provider: TIconProvider
  name: TIconName
  src: string
}

export type TNodeStyleEmojiValue = {
  type: 'emoji'
  unified: string
}

export type TNodeStyleValue = TNodeStyleIconValue | TNodeStyleEmojiValue
