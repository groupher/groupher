import { isEmpty, reject, equals } from 'ramda'

import type { TSocialItem } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

export type TRet = {
  socialLinks: TSocialItem[]
  isSocialLinksTouched: boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')

  const { socialLinks, original } = store

  const socialLinksTouched = () => {
    return !equals(socialLinks, original.socialLinks)
  }

  return {
    socialLinks: reject((item: TSocialItem) => isEmpty(item.type), socialLinks),
    isSocialLinksTouched: socialLinksTouched(),
  }
}
