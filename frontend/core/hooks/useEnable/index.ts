import type { TEnableConf } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

export default function useEnable(): TEnableConf {
  const dsb$ = useDashboard()

  return dsb$.enable
}
