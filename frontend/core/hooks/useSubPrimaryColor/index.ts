import useDashboard from '~/stores/dashboard/hooks'
import type { TColorName } from '~/spec'

export default function useSubPrimaryColor(): TColorName {
  const dsb$ = useDashboard()

  return dsb$.subPrimaryColor
}
