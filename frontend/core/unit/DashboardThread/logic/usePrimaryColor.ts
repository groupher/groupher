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
  editPrimaryColor: (color: TColorName) => void
  editCustomColor: (color: string) => void
  primaryColor: TColorName
  customColor: string
  isTouched: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function usePrimaryColor(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit, rollbackEdit, onSave } = useHelper()
  const { theme } = useTheme()

  const { primaryColor } = dsb$
  const primaryCustomColorField: TDsbStoreFieldKey =
    theme === THEME.DARK ? 'primaryCustomColorDark' : 'primaryCustomColor'
  const previewVar = theme === THEME.DARK ? '--color-primary-custom-dark' : '--color-primary-custom'
  const defaultCustomColor = getDefaultCustomColor(theme)
  const sourceColor = dsb$[primaryCustomColorField] || defaultCustomColor
  const {
    draft: customColorDraft,
    setDraft,
    isTouched: isCustomTouched,
    resetDraft,
  } = useLocalDraft(primaryCustomColorField)
  const customColor = customColorDraft || defaultCustomColor

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty(previewVar, customColor)

    return () => {
      root.style.setProperty(previewVar, sourceColor)
    }
  }, [customColor, previewVar, sourceColor])

  const isTouched = isChanged(FIELD.PRIMARY_COLOR) || isCustomTouched

  const onCancel = () => {
    resetDraft()
    rollbackEdit(FIELD.PRIMARY_COLOR)
  }

  const onConfirm = () => {
    dsb$.live$.editField(primaryCustomColorField, customColorDraft)
    window.requestAnimationFrame(() => onSave(FIELD.PRIMARY_COLOR))
  }

  return {
    edit,
    editPrimaryColor: (color) => edit(color, FIELD.PRIMARY_COLOR),
    editCustomColor: (color) => setDraft(color),
    primaryColor,
    customColor,
    isTouched,
    onCancel,
    onConfirm,
  }
}
