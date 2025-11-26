import useDashboard from '~/hooks/useDashboard'
import type { TFooterLayout, TLinkItem } from '~/spec'

type TFooterLinks = {
  layout: TFooterLayout
  links: TLinkItem[]
}

export default (): TFooterLinks => {
  const { footerLayout, footerLinks } = useDashboard()

  return {
    layout: footerLayout,
    links: footerLinks,
  }
}
