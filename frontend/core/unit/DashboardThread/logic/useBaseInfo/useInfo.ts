import { pick } from 'ramda'

import useDashboard from '~/stores/dashboard/hooks'

import { BASEINFO_BASIC_KEYS, BASEINFO_OTHER_KEYS } from '../../constant'
import type { TDsbFieldKey } from '../../spec'
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

export default function useInfo(): TRet {
  const dsb$ = useDashboard()
  const { anyChanged } = useHelper()

  return {
    ...pick(BASEINFO_BASIC_KEYS, dsb$),
    ...pick(BASEINFO_OTHER_KEYS, dsb$),
    isTouched: anyChanged(BASEINFO_BASIC_KEYS as TDsbFieldKey[]),
    isCityTouched: anyChanged(['city']),
  }
}
