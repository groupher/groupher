import { isEmpty, reject } from 'ramda'

import type { TSocialItem } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

import { FIELD } from '../../constant'
import useHelper from '../useHelper'

export type TRet = {
  socialLinks: readonly TSocialItem[]
  isSocialLinksTouched: boolean
}

/** Exposes social links state and actions through the shared React hook boundary. */
export default function useSocialLinks(): TRet {
  const { socialLinks } = useDsb()
  const { isChanged } = useHelper()

  return {
    socialLinks: reject((item: TSocialItem) => isEmpty(item.type), socialLinks),
    isSocialLinksTouched: isChanged(FIELD.SOCIAL_LINKS),
  }
}
