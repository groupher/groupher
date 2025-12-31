import useDashboard from '~/hooks/useDashboard'
import type { TColorName } from '~/spec'

export default (): TColorName => {
  const dsb$ = useDashboard()

  return dsb$.primaryColor
}
