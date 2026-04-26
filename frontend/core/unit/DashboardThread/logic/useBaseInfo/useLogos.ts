import { pick } from 'ramda'

import useDashboard from '~/stores/dashboard/hooks'

import { BASEINFO_LOGOS_KEYS } from '../../constant'
import type { TDsbFieldKey } from '../../spec'
import useHelper from '../useHelper'

export type TRet = {
  favicon: string
  logo: string
  isLogosTouched: boolean
}

export default function useLogos(): TRet {
  const dsb$ = useDashboard()
  const { anyChanged } = useHelper()

  // TODO: handle image upload

  return {
    ...pick(BASEINFO_LOGOS_KEYS, dsb$),
    isLogosTouched: anyChanged(BASEINFO_LOGOS_KEYS as TDsbFieldKey[]),
  }
}
