import { any, equals } from 'ramda'
import useDashboard from '~/hooks/useDashboard'

import type { TDsbField } from '~/stores/dashboard/spec'

export type TRet = {
  isChanged: (field: TDsbField) => boolean
  anyChanged: (fields: readonly TDsbField[]) => boolean
  mapArrayChanged: (key: string) => boolean
}

export default (): TRet => {
  const store = useDashboard()

  const { original } = store

  const isChanged = (field: TDsbField): boolean => !equals(store[field], original[field])
  const anyChanged = (fields: TDsbField[]): boolean => any(isChanged)(fields)
  const mapArrayChanged = (key: string): boolean => !equals(store[key], original[key])

  return {
    isChanged,
    anyChanged,
    mapArrayChanged,
  }
}
