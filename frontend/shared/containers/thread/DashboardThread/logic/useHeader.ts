import { pick } from 'ramda'

import type { THeaderLayout, TLinkItem, TEditFunc } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

import type { TLinkState } from '../spec'

import useLinks, { type TRet as TUserLinks } from './useLinks'
import useHelper from './useHelper'

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
