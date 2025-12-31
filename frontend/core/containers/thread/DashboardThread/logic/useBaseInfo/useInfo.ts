import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TDsbField } from '~/stores/dashboard/spec'
import { BASEINFO_BASIC_KEYS, BASEINFO_OTHER_KEYS } from '../../constant'
import useHelper from '../useHelper'

export type TRet = {
  favicon: string
  logo: string
  locale: string
  title: string
  desc: string
  introduction: string
  homepage: string
  slug: string
  city: string
  techstack: string
  isTouched: boolean
  isCityTouched: boolean
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const { anyChanged } = useHelper()

  return {
    ...pick(BASEINFO_BASIC_KEYS, dsb$),
    ...pick(BASEINFO_OTHER_KEYS, dsb$),
    isTouched: anyChanged(BASEINFO_BASIC_KEYS as TDsbField[]),
    isCityTouched: anyChanged(['city']),
  }
}
