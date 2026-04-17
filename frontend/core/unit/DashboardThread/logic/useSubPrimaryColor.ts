import { getDefaultCustomColor } from '~/const/colors'
import THEME from '~/const/theme'
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
  saving: boolean
  isTouched: boolean
}

export default function useSubPrimaryColor(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()
  const { theme } = useTheme()

  const { subPrimaryColor, saving } = dsb$
  const subPrimaryCustomColorField: TDsbFieldKey =
    theme === THEME.DARK ? 'subPrimaryCustomColorDark' : 'subPrimaryCustomColor'
  const customColor = dsb$[subPrimaryCustomColorField] || getDefaultCustomColor(theme)

  const isTouched = isChanged('subPrimaryColor') || isChanged(subPrimaryCustomColorField)

  return {
    edit,
    editSubPrimaryColor: (color) => edit(color, 'subPrimaryColor'),
    editCustomColor: (color) => edit(color, subPrimaryCustomColorField),
    subPrimaryColor,
    customColor,
    saving,
    isTouched,
  }
}
