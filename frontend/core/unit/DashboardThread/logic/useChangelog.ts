import type { TChangelogLayout, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TChangelogLayout
  isTouched: boolean
  saving: boolean
}

export default function useChangelog(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { changelogLayout, saving } = dsb$

  const isTouched = isChanged('changelogLayout')

  return {
    edit,
    layout: changelogLayout,
    saving,
    isTouched,
  }
}
