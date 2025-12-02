import { findIndex, has, omit, update } from 'ramda'
import { useCallback } from 'react'
import useDashboard from '~/hooks/useDashboard'
import type { TEditFunc, TEditValue, TNameAlias } from '~/spec'
import { BASEINFO_KEYS, DSB_DEMO_KEY, FIELD, SEO_KEYS } from '~/stores/dashboard/constant'
import type { TDsbField } from '~/stores/dashboard/spec'
import BStore from '~/utils/bstore'
import { isObject } from '~/validator'
import useMutation from '../useMutation'

export type TRet = {
  edit: TEditFunc
  rollbackEdit: (field: TDsbField) => void
  resetEdit: (field: TDsbField) => void
  onSave: (field: TDsbField) => void
}

export default (): TRet => {
  const store = useDashboard()
  const { mutation } = useMutation()

  const edit = useCallback(
    (v: TEditValue, field: TDsbField): void => {
      let value = v
      if (isObject(v) && has('target', v)) {
        value = v.target.value
      }

      store.commit({ [field]: value })
    },
    [store.commit],
  )

  const _rollbackByKeys = (keys: readonly TDsbField[]): void => {
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]
      const initValue = store.original[key]
      if (store[key] !== initValue) {
        store.commit({ [key]: initValue })
      }
    }
  }

  const _findAliasIdx = (): number => {
    const { nameAlias, editingAlias } = store
    const targetIdx = findIndex((item: TNameAlias) => item.slug === editingAlias.slug, nameAlias)

    return targetIdx
  }

  const rollbackEdit = (field: TDsbField): void => {
    if (field === FIELD.BASE_INFO) {
      _rollbackByKeys(BASEINFO_KEYS)
      return
    }

    if (field === FIELD.SEO) {
      _rollbackByKeys(SEO_KEYS)
      return
    }

    if (field === FIELD.TAG) {
      store.commit({ editingTag: null })
      return
    }

    if (field === FIELD.TAG_INDEX) {
      store.commit({ tags: store.original.tags })
      return
    }

    if (field === FIELD.FAQ_SECTIONS) {
      store.commit({ faqSections: store.original.faqSections })
      return
    }

    if (field === FIELD.NAME_ALIAS) {
      const targetIdx = _findAliasIdx()
      if (targetIdx < 0) return

      const updatedNameAlias = update(
        targetIdx,
        store.original.nameAlias[targetIdx],
        store.nameAlias,
      )
      store.commit({ editingAlias: null, nameAlias: updatedNameAlias })
      return
    }

    store.commit({ [field]: store.original[field] })
  }

  // save to local settings should omit subTabs,
  // otherwise it will be choas when save one one tab then switch to other tab
  const _saveToLocal = (): void => {
    const saveSlf = omit(
      ['curTab', 'baseInfoTab', 'aliasTab', 'layoutTab', 'layoutTab', 'broadcastTab'],
      store,
    )

    BStore.set(DSB_DEMO_KEY, JSON.stringify(saveSlf))
  }

  const resetEdit = (field: TDsbField): void => {
    console.log('## resetEdit')

    if (field === FIELD.NAME_ALIAS) {
      const targetIdx = _findAliasIdx()
      if (targetIdx < 0) return

      // self.nameAlias[targetIdx].name = self.nameAlias[targetIdx].original
      // self.editingAlias = null
      store.commit({ editingAlias: null })
    }

    _saveToLocal()
    // slf.mark({ demoAlertEnable: true })
  }

  const onSave = (field: TDsbField): void => {
    console.log('## on save: ', field)
    store.commit({ saving: true, savingField: field })

    mutation(field, store[field])
  }

  return {
    edit,
    rollbackEdit,
    resetEdit,
    onSave,
  }
}
