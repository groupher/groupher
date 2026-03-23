import useDashboard from '~/stores/dashboard/hooks'
import type { TEnableConf } from '~/spec'

export default function useEnable(): TEnableConf {
  const dsb$ = useDashboard()

  return dsb$.enable
}
