import { useEffect } from 'react'
import { getDefaultCustomColor } from '~/const/colors'
import THEME from '~/const/theme'
import useLocalDraft from '~/hooks/useLocalDraft'
import useTheme from '~/hooks/useTheme'
import type { TColorName, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import type { TDsbFieldKey } from '../spec'
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
  const subPrimaryCustomColorField: TDsbFieldKey =
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

  const isTouched = isChanged('subPrimaryColor') || isCustomTouched

  const onCancel = () => {
    resetDraft()
    rollbackEdit('subPrimaryColor')
  }

  const onConfirm = () => {
    dsb$.live$.commit({ [subPrimaryCustomColorField]: customColorDraft })
    window.requestAnimationFrame(() => onSave('subPrimaryColor'))
  }

  return {
    edit,
    editSubPrimaryColor: (color) => edit(color, 'subPrimaryColor'),
    editCustomColor: (color) => setDraft(color),
    subPrimaryColor,
    customColor,
    isTouched,
    onCancel,
    onConfirm,
  }
}
