import useDashboard from '~/hooks/useDashboard'
import type { TColorName } from '~/spec'

export default function useSubPrimaryColor(): TColorName {
  const dsb$ = useDashboard()

  return dsb$.subPrimaryColor
}
