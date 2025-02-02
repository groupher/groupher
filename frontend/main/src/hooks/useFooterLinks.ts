import type { TLinkItem, TFooterLayout } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

type TFooterLinks = {
  layout: TFooterLayout
  links: TLinkItem[]
}

export default (): TFooterLinks => {
  const { footerLayout, footerLinks } = useSubStore('dashboard')

  return {
    layout: footerLayout,
    links: footerLinks,
  }
}
