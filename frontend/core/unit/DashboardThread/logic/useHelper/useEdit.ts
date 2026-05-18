import { findIndex, has, update } from 'ramda'
import { useCallback } from 'react'

import type { TEditFunc, TEditValue, TNameAlias } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
import { isObject } from '~/validator'

import {
  BASEINFO_KEYS,
  FAQ_STORE_FIELDS,
  FIELD,
  PAGE_BG_STORE_FIELDS,
  PRIMARY_COLOR_STORE_FIELDS,
  SEO_KEYS,
  SUB_PRIMARY_COLOR_STORE_FIELDS,
  TAG_STORE_FIELDS,
} from '../../constant'
import type { TDsbFieldKey, TDsbStoreFieldKey } from '../../spec'
import useMutation from '../useMutation'

const NAME_ALIAS_FIELD = FIELD.NAME_ALIAS

export type TRet = {
  edit: TEditFunc
  rollbackEdit: (field: TDsbFieldKey) => void
  resetEdit: (field: TDsbFieldKey) => void
  onSave: (field: TDsbFieldKey) => void
}

export default function useEdit(): TRet {
  const dsb$ = useDashboard()
  const { mutation } = useMutation()

  const isStoreField = (field: TDsbFieldKey): field is TDsbStoreFieldKey => field in dsb$.original

  const edit = useCallback(
    (v: TEditValue, field: TDsbFieldKey): void => {
      let value = v
      if (isObject(v) && has('target', v)) {
        value = (v as { target: { value: TEditValue } }).target.value
      }

      if (isStoreField(field)) {
        dsb$.editField(field, value)
        return
      }

      dsb$.commit({ [field]: value })
    },
    [dsb$.commit, dsb$.editField, dsb$.original],
  )

  const _findAliasIdx = (): number => {
    const { nameAlias, editingAlias } = dsb$
    const targetIdx = findIndex((item: TNameAlias) => item.slug === editingAlias.slug, nameAlias)

    return targetIdx
  }

  const rollbackEdit = (field: TDsbFieldKey): void => {
    if (field === FIELD.PRIMARY_COLOR) {
      dsb$.rollbackFields(PRIMARY_COLOR_STORE_FIELDS)
      return
    }

    if (field === FIELD.PAGE_BG) {
      dsb$.rollbackFields(PAGE_BG_STORE_FIELDS)
      return
    }

    if (field === FIELD.PAGE_BG_DARK) {
      dsb$.rollbackFields(PAGE_BG_STORE_FIELDS)
      return
    }

    if (field === FIELD.SUB_PRIMARY_COLOR) {
      dsb$.rollbackFields(SUB_PRIMARY_COLOR_STORE_FIELDS)
      return
    }

    if (field === FIELD.BASE_INFO) {
      dsb$.rollbackFields(BASEINFO_KEYS)
      return
    }

    if (field === FIELD.SEO) {
      dsb$.rollbackFields(SEO_KEYS)
      return
    }

    if (field === FIELD.TAG) {
      dsb$.commit({ editingTag: null })
      return
    }

    if (field === FIELD.TAG_INDEX) {
      dsb$.rollbackFields(TAG_STORE_FIELDS)
      return
    }

    if (field === FIELD.FAQ_SECTIONS) {
      dsb$.rollbackFields(FAQ_STORE_FIELDS)
      return
    }

    if (field === FIELD.NAME_ALIAS) {
      const targetIdx = _findAliasIdx()
      if (targetIdx < 0) return

      const updatedNameAlias = update(targetIdx, dsb$.original.nameAlias[targetIdx], dsb$.nameAlias)
      dsb$.editField(NAME_ALIAS_FIELD, updatedNameAlias)
      dsb$.commit({ editingAlias: null })
      return
    }

    if (isStoreField(field)) {
      dsb$.rollbackFields([field])
    }
  }

  const resetEdit = (field: TDsbFieldKey): void => {
    console.log('## resetEdit')

    if (field === FIELD.NAME_ALIAS) {
      const targetIdx = _findAliasIdx()
      if (targetIdx < 0) return

      // self.nameAlias[targetIdx].name = self.nameAlias[targetIdx].original
      // self.editingAlias = null
      dsb$.commit({ editingAlias: null })
    }

    console.log('## resetEdit TODO')
    // _saveToLocal()
    // slf.mark({ demoAlertEnable: true })
  }

  const onSave = (field: TDsbFieldKey): void => {
    console.log('## on save: ', field)
    dsb$.commit({ saving: true, savingField: field })

    mutation(field, dsb$[field])
  }

  return {
    edit,
    rollbackEdit,
    resetEdit,
    onSave,
  }
}
