import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TDsbField } from '~/stores/dashboard/spec'
import { BASEINFO_LOGOS_KEYS } from '../../constant'
import useHelper from '../useHelper'

export type TRet = {
  favicon: string
  logo: string
  isLogosTouched: boolean
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const { anyChanged } = useHelper()

  // TODO: handle image upload

  return {
    ...pick(BASEINFO_LOGOS_KEYS, dsb$),
    isLogosTouched: anyChanged(BASEINFO_LOGOS_KEYS as TDsbField[]),
  }
}
