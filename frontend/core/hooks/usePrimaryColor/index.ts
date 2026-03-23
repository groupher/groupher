import useDashboard from '~/stores/dashboard/hooks'
import type { TColorName } from '~/spec'

export default function usePrimaryColor(): TColorName {
  const dsb$ = useDashboard()

  return dsb$.primaryColor
}
