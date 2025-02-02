import type { TDashboardPath } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

type TRes = {
  curTab: TDashboardPath
  changeTab: (curTab: TDashboardPath) => void
}

export default (): TRes => {
  const store = useSubStore('dashboard')

  const changeTab = (curTab: TDashboardPath): void => {
    store.commit({ curTab })
  }

  return {
    curTab: store.curTab,
    changeTab,
  }
}
