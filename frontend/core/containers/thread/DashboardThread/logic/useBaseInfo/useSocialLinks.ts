import { equals, isEmpty, reject } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TSocialItem } from '~/spec'

export type TRet = {
  socialLinks: TSocialItem[]
  isSocialLinksTouched: boolean
}

export default (): TRet => {
  const store = useDashboard()

  const { socialLinks, original } = store

  const socialLinksTouched = () => {
    return !equals(socialLinks, original.socialLinks)
  }

  return {
    // @ts-expect-error
    socialLinks: reject((item: TSocialItem) => isEmpty(item.type), socialLinks),
    isSocialLinksTouched: socialLinksTouched(),
  }
}
