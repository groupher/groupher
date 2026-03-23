import type { TColorName } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

export default function useSubPrimaryColor(): TColorName {
  const dsb$ = useDashboard()

  return dsb$.subPrimaryColor
}
