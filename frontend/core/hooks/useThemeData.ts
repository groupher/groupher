import useSubStore from '~/hooks/useSubStore'
import type { TThemeMap } from '~/spec'

export default (): TThemeMap => {
  const { themeData } = useSubStore('theme')

  return themeData
}
