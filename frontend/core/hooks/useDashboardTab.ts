import useDashboard from '~/hooks/useDashboard'
import type { TDsbPath } from '~/spec'

type TRes = {
  curTab: TDsbPath
  changeTab: (curTab: TDsbPath) => void
}

export default (): TRes => {
  const store = useDashboard()

  const changeTab = (curTab: TDsbPath): void => {
    store.commit({ curTab })
  }

  return {
    curTab: store.curTab,
    changeTab,
  }
}
