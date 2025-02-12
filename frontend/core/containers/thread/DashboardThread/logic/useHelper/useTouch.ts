import { equals, any } from 'ramda'

import useSubStore from '~/hooks/useSubStore'

import type { TSettingField } from '~/stores/dashboard/spec'

export type TRet = {
  isChanged: (field: TSettingField) => boolean
  anyChanged: (fields: TSettingField[]) => boolean
  mapArrayChanged: (key: string) => boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')

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
