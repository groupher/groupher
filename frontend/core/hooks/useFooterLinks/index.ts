import type { TFooterLayout, TLinkItem } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
import { isValidFooterLink } from '~/unit/DashboardThread/Footer/Editors/model'

type TFooterLinks = {
  layout: TFooterLayout
  links: readonly TLinkItem[]
}

export default function useFooterLinks(): TFooterLinks {
  const { footerLayout, footerLinks } = useDashboard()
  const links = footerLinks.every(isValidFooterLink) ? footerLinks : []

  return {
    layout: footerLayout,
    links,
  }
}
