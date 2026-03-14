import { equals, isEmpty, reject } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TSocialItem } from '~/spec'

export type TRet = {
  socialLinks: readonly TSocialItem[]
  isSocialLinksTouched: boolean
}

export default function useSocialLinks(): TRet {
  const { socialLinks, original } = useDashboard()

  const socialLinksTouched = () => {
    return !equals(socialLinks, original.socialLinks)
  }

  return {
    socialLinks: reject((item: TSocialItem) => isEmpty(item.type), socialLinks),
    isSocialLinksTouched: socialLinksTouched(),
  }
}
