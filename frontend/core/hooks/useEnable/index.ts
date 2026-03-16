import useDashboard from '~/hooks/useDashboard'
import type { TEnableConf } from '~/spec'

export default function useEnable(): TEnableConf {
  const dsb$ = useDashboard()

  return dsb$.enable
}
