import { pick } from 'ramda'

import type { TEditFunc, THeaderLayout, THeaderLinkItem } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import type { TLinkState } from '../spec'
import useHelper from './useHelper'
import useLinkDerived, { type TRet as TDerived } from './useLinkDerived'

type TRet = {
  headerLayout: THeaderLayout
  headerLinks: readonly THeaderLinkItem[]
  edit: TEditFunc
} & TLinkState &
  TDerived

export default function useHeader(): TRet {
  const dsb$ = useDashboard()
  const derived = useLinkDerived()
  const { edit } = useHelper()

  return {
    ...pick(
      [
        'headerLayout',
        'headerLinks',
        'editingLink',
        'editingLinkMode',
        'editingGroup',
        'editingGroupIndex',
        'saving',
      ],
      dsb$,
    ),
    edit,
    ...derived,
  }
}
