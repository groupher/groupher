import { pick } from 'ramda'

import type { TEditFunc, THeaderLayout, TLinkItem } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

import type { TLinkState } from '../spec'
import useHelper from './useHelper'
import useLinkDerived, { type TRet as TDerived } from './useLinkDerived'

type TRet = {
  headerLayout: THeaderLayout
  headerLinks: readonly TLinkItem[]
  edit: TEditFunc
} & TLinkState &
  TDerived

/** Exposes header state and actions through the shared React hook boundary. */
export default function useHeader(): TRet {
  const dsb$ = useDsb()
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
