import { any, equals } from 'ramda'
import useDashboard from '~/hooks/useDashboard'

import type { TSettingField } from '~/stores/dashboard/spec'

export type TRet = {
  isChanged: (field: TSettingField) => boolean
  anyChanged: (fields: readonly TSettingField[]) => boolean
  mapArrayChanged: (key: string) => boolean
}

export default (): TRet => {
  const store = useDashboard()

  const { original } = store

  const isChanged = (field: TSettingField): boolean => !equals(store[field], original[field])
  const anyChanged = (fields: TSettingField[]): boolean => any(isChanged)(fields)
  const mapArrayChanged = (key: string): boolean => !equals(store[key], original[key])

  return {
    isChanged,
    anyChanged,
    mapArrayChanged,
  }
}
