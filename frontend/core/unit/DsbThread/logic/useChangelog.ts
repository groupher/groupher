import type { TChangelogLayout, TEditFunc } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

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
  const dsb$ = useDsb()
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
