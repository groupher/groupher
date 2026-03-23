import type { TLinkItem } from '~/spec'

export type TProps = {
  links: readonly TLinkItem[]
  activePath?: string
}

export type TLinkGroup = {
  groupTitle: string
  links: readonly TLinkItem[]
  showMoreFold: boolean
  activePath?: string
}
