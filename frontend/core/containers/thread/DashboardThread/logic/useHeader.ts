import { pick } from 'ramda'
import useSubStore from '~/hooks/useSubStore'
import type { TEditFunc, THeaderLayout, TLinkItem } from '~/spec'

import type { TLinkState } from '../spec'
import useHelper from './useHelper'
import useLinks, { type TRet as TUserLinks } from './useLinks'

type TRet = {
  headerLayout: THeaderLayout
  headerLinks: TLinkItem[]
  edit: TEditFunc
} & TLinkState &
  TUserLinks

export default (): TRet => {
  const store = useSubStore('dashboard')
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
      store,
    ),
    edit,
    ...useLinksData,
  }
}
