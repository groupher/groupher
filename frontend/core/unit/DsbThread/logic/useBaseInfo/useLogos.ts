import { pick } from 'ramda'

import useDsb from '~/stores/dsb/hooks'

import { BASEINFO_LOGOS_KEYS } from '../../constant'
import type { TDsbFieldKey } from '../../spec'
import useHelper from '../useHelper'

export type TRet = {
  favicon: string
  logo: string
  isLogosTouched: boolean
}

/** Exposes logos state and actions through the shared React hook boundary. */
export default function useLogos(): TRet {
  const dsb$ = useDsb()
  const { anyChanged } = useHelper()

  // TODO: handle image upload

  return {
    ...pick(BASEINFO_LOGOS_KEYS, dsb$),
    isLogosTouched: anyChanged(BASEINFO_LOGOS_KEYS as TDsbFieldKey[]),
  }
}
