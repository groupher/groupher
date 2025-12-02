import useDashboard from '~/hooks/useDashboard'
import type { TEnableConf } from '~/spec'

export default (): TEnableConf => {
  const store = useDashboard()

  return store.enable
}
