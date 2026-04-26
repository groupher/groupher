import { pick } from 'ramda'

import type { TEditFunc, THeaderLayout, TLinkItem } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import type { TLinkState } from '../spec'
import useHelper from './useHelper'
import useLinks, { type TRet as TUserLinks } from './useLinks'

type TRet = {
  headerLayout: THeaderLayout
  headerLinks: readonly TLinkItem[]
  edit: TEditFunc
} & TLinkState &
  TUserLinks

export default function useHeader(): TRet {
  const dsb$ = useDashboard()
  const useLinksData = useLinks()
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
    ...useLinksData,
  }
}
