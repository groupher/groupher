import THEME from '~/const/theme'
import useDidMount from '~/hooks/useDidMount'
import useTheme from '~/hooks/useTheme'
import Dark from './Dark'
import Light from './Light'

export default function GaussBlur() {
  const { theme } = useTheme()
  const mounted = useDidMount()

  if (!mounted) {
    return null
  }

  return theme === THEME.LIGHT ? <Light /> : <Dark />
}
