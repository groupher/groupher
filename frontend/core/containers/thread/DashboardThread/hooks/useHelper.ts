import { any, equals } from 'ramda'
import useDashboard from '~/hooks/useDashboard'

import type { TDsbField } from '../spec'

type TRet = {
  isChanged: (field: TDsbField) => boolean
  anyChanged: (fields: TDsbField[]) => boolean
  mapArrayChanged: (key: string) => boolean
}

export default (): TRet => {
  const dsb$ = useDashboard()

  const { original } = dsb$

  const isChanged = (field: TDsbField): boolean => !equals(dsb$[field], original[field])
  const anyChanged = (fields: TDsbField[]): boolean => any(isChanged)(fields)

  const mapArrayChanged = (key: string): boolean =>
    JSON.stringify(dsb$[key]) !== JSON.stringify(original[key])

  return {
    isChanged,
    anyChanged,
    mapArrayChanged,
  }
}
