import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import Dark from './Dark'
import Light from './Light'

export default () => {
  const { theme } = useTheme()

  return theme === THEME.LIGHT ? <Light /> : <Dark />
}
