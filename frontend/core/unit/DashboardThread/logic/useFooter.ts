import type { TEditFunc, TFooterLayout, TFooterOnelineLink, TLinkItem } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import type { TLinkState } from '../spec'
import useHelper from './useHelper'
import useLinkDerived, { type TRet as TDerived } from './useLinkDerived'

type TRet = {
  footerLayout: TFooterLayout
  footerLinks: readonly TLinkItem[]
  footerOnelineLinks: readonly TFooterOnelineLink[]
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
    footerOnelineLinks,
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
    footerOnelineLinks,
    editingLink,
    editingLinkMode,
    editingGroup,
    editingGroupIndex,
    saving,
    ...derived,
  }
}
