import { equals, any } from 'ramda'

import useSubStore from '~/hooks/useSubStore'

import type { TSettingField } from '../spec'

type TRet = {
  isChanged: (field: TSettingField) => boolean
  anyChanged: (fields: TSettingField[]) => boolean
  mapArrayChanged: (key: string) => boolean
}

export default (): TRet => {
  const dashboard = useSubStore('dashboard')

  const { original } = dashboard

  const isChanged = (field: TSettingField): boolean => !equals(dashboard[field], original[field])
  const anyChanged = (fields: TSettingField[]): boolean => any(isChanged)(fields)

  const mapArrayChanged = (key: string): boolean =>
    JSON.stringify(dashboard[key]) !== JSON.stringify(original[key])

  return {
    isChanged,
    anyChanged,
    mapArrayChanged,
  }
}
