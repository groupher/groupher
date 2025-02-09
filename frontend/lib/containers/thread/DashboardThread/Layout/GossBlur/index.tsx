import useTheme from '~/hooks/useTheme'
import THEME from '~/const/theme'

import GossBlurDay from './GossBlurDay'
import GossBlurNight from './GossBlurNight'

export default () => {
  const { theme } = useTheme()

  return theme === THEME.LIGHT ? <GossBlurDay /> : <GossBlurNight />
}
