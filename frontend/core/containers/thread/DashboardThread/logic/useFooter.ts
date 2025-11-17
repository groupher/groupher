import useSubStore from '~/hooks/useSubStore'
import type { TEditFunc, TFooterLayout, TLinkItem } from '~/spec'

import type { TLinkState } from '../spec'
import useHelper from './useHelper'
import useLinks, { type TRet as TUserLinks } from './useLinks'

type TRet = {
  footerLayout: TFooterLayout
  footerLinks: TLinkItem[]
  edit: TEditFunc
} & TLinkState &
  TUserLinks

export default (): TRet => {
  const store = useSubStore('dashboard')

  const useLinksData = useLinks()
  const { edit } = useHelper()

  const {
    footerLayout,
    footerLinks,
    editingLink,
    editingLinkMode,
    editingGroup,
    editingGroupIndex,
    saving,
  } = store

  return {
    edit,
    footerLayout,
    footerLinks,
    editingLink,
    editingLinkMode,
    editingGroup,
    editingGroupIndex,
    saving,
    ...useLinksData,
  }
}
