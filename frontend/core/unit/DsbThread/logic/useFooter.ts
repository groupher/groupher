import type { TEditFunc, TFooterLayout, TFooterOnelineLink, TLinkItem } from '~/spec'
import useDsbShell from '~/stores/dsbShell/hooks'

import useHelper from './useHelper'
import useLinkDerived, { type TRet as TDerived } from './useLinkDerived'

type TRet = {
  footerLayout: TFooterLayout
  footerLinks: readonly TLinkItem[]
  footerOnelineLinks: readonly TFooterOnelineLink[]
  edit: TEditFunc
  saving: boolean
} & TDerived

/** Exposes footer state and actions through the shared React hook boundary. */
export default function useFooter(): TRet {
  const dsb$ = useDsbShell()

  const derived = useLinkDerived()
  const { edit, isPending } = useHelper()

  const { footerLayout, footerLinks, footerOnelineLinks } = dsb$

  return {
    edit,
    footerLayout,
    footerLinks,
    footerOnelineLinks,
    saving: isPending,
    ...derived,
  }
}
