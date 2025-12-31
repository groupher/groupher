import useDashboard from '~/hooks/useDashboard'
import type { TEnableConf } from '~/spec'

export default (): TEnableConf => {
  const dsb$ = useDashboard()

  return dsb$.enable
}
