import { DSB_BROADCAST_ROUTE } from '~/const/route'
import useBroadcast from '../../logic/useBroadcast'
import ArticleEditor from './Article'
import GlobalEditor from './Global'

export default () => {
  const { broadcastTab } = useBroadcast()

  return broadcastTab === DSB_BROADCAST_ROUTE.GLOBAL ? <GlobalEditor /> : <ArticleEditor />
}
