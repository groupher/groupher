import useSubStore from '~/hooks/useSubStore'
import type { TColorName } from '~/spec'

export default (): TColorName => {
  const store = useSubStore('dashboard')

  return store.primaryColor
}
