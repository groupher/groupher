import type { TLinkChild, TResolvedHeaderLinkItem } from '~/spec'

export type TProps = {
  links?: readonly TResolvedHeaderLinkItem[]
  activePath?: string
}

export type TLinkGroup = {
  groupTitle: string
  links: readonly TLinkChild[]
  showMoreFold: boolean
  activePath?: string
}
