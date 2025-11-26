import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TSettingField } from '~/stores/dashboard/spec'
import { BASEINFO_LOGOS_KEYS } from '../../constant'
import useHelper from '../useHelper'

export type TRet = {
  favicon: string
  logo: string
  isLogosTouched: boolean
}

export default (): TRet => {
  const store = useDashboard()
  const { anyChanged } = useHelper()

  // TODO: handle image upload

  return {
    ...pick(BASEINFO_LOGOS_KEYS, store),
    isLogosTouched: anyChanged(BASEINFO_LOGOS_KEYS as TSettingField[]),
  }
}
