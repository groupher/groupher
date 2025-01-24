import { useCallback } from 'react'

import type { TChangelogLayout, TEditFunc } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TChangelogLayout
  getIsTouched: () => boolean
  saving: boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  const { changelogLayout, saving } = store

  // drived
  const getIsTouched = useCallback(() => isChanged('changelogLayout'), [store])

  return {
    edit,
    layout: changelogLayout,
    saving,
    getIsTouched,
  }
}
