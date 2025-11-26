import useDashboard from '~/hooks/useDashboard'
import type { TColorName, TEditFunc, TTopbarLayout } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TTopbarLayout
  isLayoutTouched: boolean
  isBgTouched: boolean
  saving: boolean
  bg: TColorName
}

export default (): TRet => {
  const store = useDashboard()
  const { isChanged, edit } = useHelper()

  if (store === null) {
    throw new Error('Store cannot be null, please add a context provider')
  }

  const { topbarLayout, topbarBg, saving } = store

  const isLayoutTouched = isChanged('topbarLayout')
  const isBgTouched = isChanged('topbarBg')

  return {
    edit,
    layout: topbarLayout,
    isLayoutTouched,
    isBgTouched,
    bg: topbarBg,
    saving,
  }
}
