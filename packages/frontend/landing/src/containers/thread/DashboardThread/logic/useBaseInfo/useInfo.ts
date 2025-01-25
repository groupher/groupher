import { pick } from 'ramda'

import type { TSettingField } from '~/stores/dashboard/spec'
import useSubStore from '~/hooks/useSubStore'

import useHelper from '../useHelper'
import { BASEINFO_BASIC_KEYS, BASEINFO_OTHER_KEYS } from '../../constant'

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
  const store = useSubStore('dashboard')
  const { anyChanged } = useHelper()

  return {
    ...pick(BASEINFO_BASIC_KEYS, store),
    ...pick(BASEINFO_OTHER_KEYS, store),
    isTouched: anyChanged(BASEINFO_BASIC_KEYS as TSettingField[]),
    isCityTouched: anyChanged(['city']),
  }
}
