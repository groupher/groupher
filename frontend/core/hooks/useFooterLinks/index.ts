import useDashboard from '~/stores/dashboard/hooks'
import type { TFooterLayout, TLinkItem } from '~/spec'

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
