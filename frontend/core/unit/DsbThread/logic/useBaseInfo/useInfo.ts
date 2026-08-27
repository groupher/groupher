import { pick } from 'ramda'

import useDsb from '~/stores/dsb/hooks'

import { BASEINFO_BASIC_KEYS, BASEINFO_OTHER_KEYS, FIELD } from '../../constant'
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

/** Exposes info state and actions through the shared React hook boundary. */
export default function useInfo(): TRet {
  const dsb$ = useDsb()
  const { anyChanged } = useHelper()

  return {
    ...pick(BASEINFO_BASIC_KEYS, dsb$),
    ...pick(BASEINFO_OTHER_KEYS, dsb$),
    isTouched: anyChanged(BASEINFO_BASIC_KEYS as TDsbFieldKey[]),
    isCityTouched: anyChanged([FIELD.CITY]),
  }
}
