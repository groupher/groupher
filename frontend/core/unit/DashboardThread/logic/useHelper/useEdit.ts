import { findIndex, has, update } from 'ramda'
import { useCallback } from 'react'
import type { TEditFunc, TEditValue, TNameAlias } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
import { isObject } from '~/validator'
import { BASEINFO_KEYS, FIELD, SEO_KEYS } from '../../constant'
import type { TDsbFieldKey } from '../../spec'
import useMutation from '../useMutation'

export type TRet = {
  edit: TEditFunc
  rollbackEdit: (field: TDsbFieldKey) => void
  resetEdit: (field: TDsbFieldKey) => void
  onSave: (field: TDsbFieldKey) => void
}

export default function useEdit(): TRet {
  const dsb$ = useDashboard()
  const { mutation } = useMutation()

  const edit = useCallback(
    (v: TEditValue, field: TDsbFieldKey): void => {
      let value = v
      if (isObject(v) && has('target', v)) {
        value = v.target.value
      }

      dsb$.commit({ [field]: value })
    },
    [dsb$.commit],
  )

  const _rollbackByKeys = (keys: readonly TDsbFieldKey[]): void => {
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]
      const initValue = dsb$.original[key]
      if (dsb$[key] !== initValue) {
        dsb$.commit({ [key]: initValue })
      }
    }
  }

  const _findAliasIdx = (): number => {
    const { nameAlias, editingAlias } = dsb$
    const targetIdx = findIndex((item: TNameAlias) => item.slug === editingAlias.slug, nameAlias)

    return targetIdx
  }

  const rollbackEdit = (field: TDsbFieldKey): void => {
    if (field === FIELD.PRIMARY_COLOR) {
      dsb$.commit({
        primaryColor: dsb$.original.primaryColor,
        primaryCustomColor: dsb$.original.primaryCustomColor,
        primaryCustomColorDark: dsb$.original.primaryCustomColorDark,
      })
      return
    }

    if (field === FIELD.PAGE_BG) {
      dsb$.commit({
        pageBg: dsb$.original.pageBg,
        pageCustomBg: dsb$.original.pageCustomBg,
        pageCustomIntensity: dsb$.original.pageCustomIntensity,
        pageBgDark: dsb$.original.pageBgDark,
        pageCustomBgDark: dsb$.original.pageCustomBgDark,
        pageCustomIntensityDark: dsb$.original.pageCustomIntensityDark,
      })
      return
    }

    if (field === FIELD.PAGE_BG_DARK) {
      dsb$.commit({
        pageBg: dsb$.original.pageBg,
        pageCustomBg: dsb$.original.pageCustomBg,
        pageCustomIntensity: dsb$.original.pageCustomIntensity,
        pageBgDark: dsb$.original.pageBgDark,
        pageCustomBgDark: dsb$.original.pageCustomBgDark,
        pageCustomIntensityDark: dsb$.original.pageCustomIntensityDark,
      })
      return
    }

    if (field === FIELD.SUB_PRIMARY_COLOR) {
      dsb$.commit({
        subPrimaryColor: dsb$.original.subPrimaryColor,
        subPrimaryCustomColor: dsb$.original.subPrimaryCustomColor,
        subPrimaryCustomColorDark: dsb$.original.subPrimaryCustomColorDark,
      })
      return
    }

    if (field === FIELD.BASE_INFO) {
      _rollbackByKeys(BASEINFO_KEYS)
      return
    }

    if (field === FIELD.SEO) {
      _rollbackByKeys(SEO_KEYS)
      return
    }

    if (field === FIELD.TAG) {
      dsb$.commit({ editingTag: null })
      return
    }

    if (field === FIELD.TAG_INDEX) {
      dsb$.commit({ tags: [...dsb$.original.tags] })
      return
    }

    if (field === FIELD.FAQ_SECTIONS) {
      dsb$.commit({ faqSections: dsb$.original.faqSections })
      return
    }

    if (field === FIELD.NAME_ALIAS) {
      const targetIdx = _findAliasIdx()
      if (targetIdx < 0) return

      const updatedNameAlias = update(targetIdx, dsb$.original.nameAlias[targetIdx], dsb$.nameAlias)
      dsb$.commit({ editingAlias: null, nameAlias: updatedNameAlias })
      return
    }

    dsb$.commit({ [field]: dsb$.original[field] })
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
