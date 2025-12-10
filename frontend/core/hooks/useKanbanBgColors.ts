import useDashboard from '~/hooks/useDashboard'
import type { TColorName } from '~/spec'

export default (): TColorName[] => {
  const store = useDashboard()

  // @ts-expect-error
  return store.kanbanBgColors
}
