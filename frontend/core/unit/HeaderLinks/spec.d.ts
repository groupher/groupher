import type { THeaderLinkChild, TResolvedHeaderLinkItem } from '~/spec'

export type TProps = {
  links?: readonly TResolvedHeaderLinkItem[]
  activePath?: string
}

export type TLinkGroup = {
  groupTitle: string
  links: readonly THeaderLinkChild[]
  showMoreFold: boolean
  activePath?: string
}
