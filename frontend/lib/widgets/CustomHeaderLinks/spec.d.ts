import type { TLinkItem } from '~/spec'

export type TProps = {
  links: TLinkItem[]
  activePath?: string
}

export type TLinkGroup = {
  groupTitle: string
  links: TLinkItem[]
  showMoreFold: boolean
  activePath?: string
}
