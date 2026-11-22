import { pick } from 'ramda'

import type { TEditFunc, THeaderLayout, TLinkItem } from '~/spec'
import useDsbShell from '~/stores/dsbShell/hooks'

import useHelper from './useHelper'
import useLinkDerived, { type TRet as TDerived } from './useLinkDerived'

type TRet = {
  headerLayout: THeaderLayout
  headerLinks: readonly TLinkItem[]
  edit: TEditFunc
  saving: boolean
} & TDerived

/** Exposes header state and actions through the shared React hook boundary. */
export default function useHeader(): TRet {
  const dsb$ = useDsbShell()
  const derived = useLinkDerived()
  const { edit, isPending } = useHelper()

  return {
    ...pick(['headerLayout', 'headerLinks'], dsb$),
    edit,
    saving: isPending,
    ...derived,
  }
}
