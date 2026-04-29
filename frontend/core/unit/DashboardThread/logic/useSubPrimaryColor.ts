import { useEffect } from 'react'

import { getDefaultCustomColor } from '~/const/colors'
import THEME from '~/const/theme'
import useLocalDraft from '~/hooks/useLocalDraft'
import useTheme from '~/hooks/useTheme'
import type { TColorName, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import type { TDsbStoreFieldKey } from '../spec'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  editSubPrimaryColor: (color: TColorName) => void
  editCustomColor: (color: string) => void
  subPrimaryColor: TColorName
  customColor: string
  isTouched: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function useSubPrimaryColor(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit, rollbackEdit, onSave } = useHelper()
  const { theme } = useTheme()

  const { subPrimaryColor } = dsb$
  const subPrimaryCustomColorField: TDsbStoreFieldKey =
    theme === THEME.DARK ? 'subPrimaryCustomColorDark' : 'subPrimaryCustomColor'
  const previewVar =
    theme === THEME.DARK ? '--color-sub-primary-custom-dark' : '--color-sub-primary-custom'
  const defaultCustomColor = getDefaultCustomColor(theme)
  const sourceColor = dsb$[subPrimaryCustomColorField] || defaultCustomColor
  const {
    draft: customColorDraft,
    setDraft,
    isTouched: isCustomTouched,
    resetDraft,
  } = useLocalDraft(subPrimaryCustomColorField)
  const customColor = customColorDraft || defaultCustomColor

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty(previewVar, customColor)

    return () => {
      root.style.setProperty(previewVar, sourceColor)
    }
  }, [customColor, previewVar, sourceColor])

  const isTouched = isChanged(FIELD.SUB_PRIMARY_COLOR) || isCustomTouched

  const onCancel = () => {
    resetDraft()
    rollbackEdit(FIELD.SUB_PRIMARY_COLOR)
  }

  const onConfirm = () => {
    dsb$.live$.editField(subPrimaryCustomColorField, customColorDraft)
    window.requestAnimationFrame(() => onSave(FIELD.SUB_PRIMARY_COLOR))
  }

  return {
    edit,
    editSubPrimaryColor: (color) => edit(color, FIELD.SUB_PRIMARY_COLOR),
    editCustomColor: (color) => setDraft(color),
    subPrimaryColor,
    customColor,
    isTouched,
    onCancel,
    onConfirm,
  }
}
