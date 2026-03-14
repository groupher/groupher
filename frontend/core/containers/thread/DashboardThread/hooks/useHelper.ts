import { any, equals } from 'ramda'
import useDashboard from '~/hooks/useDashboard'

import type { TDsbFieldKey } from '../spec'

type TRet = {
  isChanged: (field: TDsbFieldKey) => boolean
  anyChanged: (fields: TDsbFieldKey[]) => boolean
  mapArrayChanged: (key: string) => boolean
}

export default function useHelper(): TRet {
  const dsb$ = useDashboard()

  const { original } = dsb$

  const isChanged = (field: TDsbFieldKey): boolean => !equals(dsb$[field], original[field])
  const anyChanged = (fields: TDsbFieldKey[]): boolean => any(isChanged)(fields)

  const mapArrayChanged = (key: string): boolean =>
    JSON.stringify(dsb$[key]) !== JSON.stringify(original[key])

  return {
    isChanged,
    anyChanged,
    mapArrayChanged,
  }
}
