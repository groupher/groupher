import type { TColorName } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

export default function usePrimaryColor(): TColorName {
  const dsb$ = useDashboard()

  return dsb$.primaryColor
}
