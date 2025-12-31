import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TEditFunc, THeaderLayout, TLinkItem } from '~/spec'

import type { TLinkState } from '../spec'
import useHelper from './useHelper'
import useLinks, { type TRet as TUserLinks } from './useLinks'

type TRet = {
  headerLayout: THeaderLayout
  headerLinks: readonly TLinkItem[]
  edit: TEditFunc
} & TLinkState &
  TUserLinks

export default (): TRet => {
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
