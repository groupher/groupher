import { isEmpty, reject } from 'ramda'

import type { TSocialItem } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../../constant'
import useHelper from '../useHelper'

export type TRet = {
  socialLinks: readonly TSocialItem[]
  isSocialLinksTouched: boolean
}

export default function useSocialLinks(): TRet {
  const { socialLinks } = useDashboard()
  const { isChanged } = useHelper()

  return {
    socialLinks: reject((item: TSocialItem) => isEmpty(item.type), socialLinks),
    isSocialLinksTouched: isChanged(FIELD.SOCIAL_LINKS),
  }
}
