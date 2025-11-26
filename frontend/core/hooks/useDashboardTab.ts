import useDashboard from '~/hooks/useDashboard'
import type { TDashboardPath } from '~/spec'

type TRes = {
  curTab: TDashboardPath
  changeTab: (curTab: TDashboardPath) => void
}

export default (): TRes => {
  const store = useDashboard()

  const changeTab = (curTab: TDashboardPath): void => {
    store.commit({ curTab })
  }

  return {
    curTab: store.curTab,
    changeTab,
  }
}
