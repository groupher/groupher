import type { TFooterLayout, TFooterOnelineLink, TLinkItem } from '~/spec'

export type TFooterLinks = {
  layout: TFooterLayout
  links: readonly TLinkItem[]
  onelineLinks: readonly TFooterOnelineLink[]
}
