import type { TFooterLayout, TLinkItem } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

type TFooterLinks = {
  layout: TFooterLayout
  links: readonly TLinkItem[]
}

export default function useFooterLinks(): TFooterLinks {
  const { footerLayout, footerLinks } = useDashboard()

  return {
    layout: footerLayout,
    links: footerLinks,
  }
}
