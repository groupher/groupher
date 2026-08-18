import type { TEnableConf } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

/** Exposes enable state and actions through the shared React hook boundary. */
export default function useEnable(): TEnableConf {
  const dsb$ = useDashboard()

  return dsb$.enable
}
