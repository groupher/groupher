import type { TFooterLayout, TFooterOnelineLink, TLinkItem } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
import {
  isValidFooterLink,
  isValidFooterOnelineLinks,
} from '~/unit/DashboardThread/Footer/Editors/model'

type TFooterLinks = {
  layout: TFooterLayout
  links: readonly TLinkItem[]
  onelineLinks: readonly TFooterOnelineLink[]
}

export default function useFooterLinks(): TFooterLinks {
  const { footerLayout, footerLinks, footerOnelineLinks } = useDashboard()
  const links = footerLinks.every(isValidFooterLink) ? footerLinks : []
  const onelineLinks = isValidFooterOnelineLinks(footerOnelineLinks) ? footerOnelineLinks : []

  return {
    layout: footerLayout,
    links,
    onelineLinks,
  }
}
