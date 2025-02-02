import useSubStore from '~/hooks/useSubStore'
import type { TEnableConfig } from '~/spec'

export default (): TEnableConfig => {
  const store = useSubStore('dashboard')

  return store.enable
}
