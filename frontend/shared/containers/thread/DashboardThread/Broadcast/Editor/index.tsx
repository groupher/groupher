import { DASHBOARD_BROADCAST_ROUTE } from '~/const/route'

import GlobalEditor from './Global'
import ArticleEditor from './Article'

import useBroadcast from '../../logic/useBroadcast'

export default () => {
  const { broadcastTab } = useBroadcast()

  return broadcastTab === DASHBOARD_BROADCAST_ROUTE.GLOBAL ? <GlobalEditor /> : <ArticleEditor />
}
