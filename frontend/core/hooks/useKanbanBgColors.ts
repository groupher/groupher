import useDashboard from '~/hooks/useDashboard'
import type { TColorName } from '~/spec'

export default (): readonly TColorName[] => {
  const dsb$ = useDashboard()

  return dsb$.kanbanBgColors
}
