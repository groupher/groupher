import type { TColorName } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

export default (): TColorName => {
  const store = useSubStore('dashboard')

  return store.primaryColor
}
