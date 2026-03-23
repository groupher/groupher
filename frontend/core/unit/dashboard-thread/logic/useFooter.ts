import useDashboard from '~/stores/dashboard/hooks'
import type { TEditFunc, TFooterLayout, TLinkItem } from '~/spec'

import type { TLinkState } from '../spec'
import useHelper from './useHelper'
import useLinks, { type TRet as TUserLinks } from './useLinks'

type TRet = {
  footerLayout: TFooterLayout
  footerLinks: readonly TLinkItem[]
  edit: TEditFunc
} & TLinkState &
  TUserLinks

export default function useFooter(): TRet {
  const dsb$ = useDashboard()

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
  } = dsb$

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
