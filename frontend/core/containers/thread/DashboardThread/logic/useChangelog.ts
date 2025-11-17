import useSubStore from '~/hooks/useSubStore'
import type { TChangelogLayout, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TChangelogLayout
  isTouched: boolean
  saving: boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  const { changelogLayout, saving } = store

  const isTouched = isChanged('changelogLayout')

  return {
    edit,
    layout: changelogLayout,
    saving,
    isTouched,
  }
}
