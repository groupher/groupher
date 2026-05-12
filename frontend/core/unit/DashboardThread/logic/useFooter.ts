import type { TEditFunc, TFooterLayout, TLinkItem } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import type { TLinkState } from '../spec'
import useHelper from './useHelper'
import useLinkDerived, { type TRet as TDerived } from './useLinkDerived'

type TRet = {
  footerLayout: TFooterLayout
  footerLinks: readonly TLinkItem[]
  edit: TEditFunc
  resetEditingLink: () => void
} & TLinkState &
  TDerived

export default function useFooter(): TRet {
  const dsb$ = useDashboard()

  const derived = useLinkDerived()
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
    resetEditingLink: () => dsb$.commit({ editingLink: null }),
    footerLayout,
    footerLinks,
    editingLink,
    editingLinkMode,
    editingGroup,
    editingGroupIndex,
    saving,
    ...derived,
  }
}
