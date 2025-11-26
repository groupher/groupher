import useDashboard from '~/hooks/useDashboard'
import type { TColorName } from '~/spec'

export default (): TColorName[] => {
  const store = useDashboard()

  return store.kanbanBgColors
}
