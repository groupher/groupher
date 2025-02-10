import type { TThemeMap } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

export default (): TThemeMap => {
  const { themeData } = useSubStore('theme')

  return themeData
}
