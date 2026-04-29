import { equals } from 'ramda'

import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../../constant'
import type { TDsbFieldKey, TDsbStoreFieldKey } from '../../spec'

export type TRet = {
  isChanged: (field: TDsbFieldKey) => boolean
  anyChanged: (fields: readonly TDsbFieldKey[]) => boolean
  mapArrayChanged: (key: string) => boolean
}

const LEGACY_COMPARE_FIELDS = new Set<TDsbStoreFieldKey>([FIELD.HEADER_LINKS, FIELD.FOOTER_LINKS])

export default function useTouch(): TRet {
  const dsb$ = useDashboard()

  const { original, touchedFields } = dsb$

  const isStoreField = (field: TDsbFieldKey | string): field is TDsbStoreFieldKey =>
    field in original

  const isChanged = (field: TDsbFieldKey): boolean => {
    if (!isStoreField(field)) {
      return !equals(dsb$[field], original[field])
    }

    if (LEGACY_COMPARE_FIELDS.has(field)) {
      return !equals(dsb$[field], original[field])
    }

    return Boolean(touchedFields[field])
  }

  const anyChanged = (fields: TDsbFieldKey[]): boolean => fields.some(isChanged)
  const mapArrayChanged = (key: string): boolean => isChanged(key as TDsbFieldKey)

  return {
    isChanged,
    anyChanged,
    mapArrayChanged,
  }
}
