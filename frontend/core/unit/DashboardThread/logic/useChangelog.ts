import type { TChangelogLayout, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TChangelogLayout
  isTouched: boolean
  saving: boolean
}

/** Exposes changelog state and actions through the shared React hook boundary. */
export default function useChangelog(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { changelogLayout, saving } = dsb$

  const isTouched = isChanged(FIELD.CHANGELOG_LAYOUT)

  return {
    edit,
    layout: changelogLayout,
    saving,
    isTouched,
  }
}
