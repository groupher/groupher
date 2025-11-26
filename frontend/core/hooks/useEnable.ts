import useDashboard from '~/hooks/useDashboard'
import type { TEnableConfig } from '~/spec'

export default (): TEnableConfig => {
  const store = useDashboard()

  return store.enable
}
