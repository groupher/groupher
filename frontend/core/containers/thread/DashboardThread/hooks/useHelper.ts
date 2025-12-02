import { any, equals } from 'ramda'
import useDashboard from '~/hooks/useDashboard'

import type { TDsbField } from '../spec'

type TRet = {
  isChanged: (field: TDsbField) => boolean
  anyChanged: (fields: TDsbField[]) => boolean
  mapArrayChanged: (key: string) => boolean
}

export default (): TRet => {
  const dashboard = useDashboard()

  const { original } = dashboard

  const isChanged = (field: TDsbField): boolean => !equals(dashboard[field], original[field])
  const anyChanged = (fields: TDsbField[]): boolean => any(isChanged)(fields)

  const mapArrayChanged = (key: string): boolean =>
    JSON.stringify(dashboard[key]) !== JSON.stringify(original[key])

  return {
    isChanged,
    anyChanged,
    mapArrayChanged,
  }
}
