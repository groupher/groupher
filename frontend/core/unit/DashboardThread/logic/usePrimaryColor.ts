import { getDefaultCustomColor } from '~/const/colors'
import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import type { TColorName, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import type { TDsbFieldKey } from '../spec'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  editPrimaryColor: (color: TColorName) => void
  editCustomColor: (color: string) => void
  primaryColor: TColorName
  customColor: string
  saving: boolean
  isTouched: boolean
}

export default function usePrimaryColor(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()
  const { theme } = useTheme()

  const { primaryColor, saving } = dsb$
  const primaryCustomColorField: TDsbFieldKey =
    theme === THEME.DARK ? 'primaryCustomColorDark' : 'primaryCustomColor'
  const customColor = dsb$[primaryCustomColorField] || getDefaultCustomColor(theme)

  const isTouched = isChanged('primaryColor') || isChanged(primaryCustomColorField)

  return {
    edit,
    editPrimaryColor: (color) => edit(color, 'primaryColor'),
    editCustomColor: (color) => edit(color, primaryCustomColorField),
    primaryColor,
    customColor,
    saving,
    isTouched,
  }
}
