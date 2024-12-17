import type { TArticle } from '~/spec'
import EVENT from '~/const/event'
import { send, previewArticle } from '~/signal'

import useNaviArticle from '~/hooks/useNaviArticle'

import ArrowSVG from '~/icons/ArrowSimple'

import useSalon, { cn } from '../styles/drawer_header/article_navi'

const naviToArticle = (article: TArticle): void => {
  // store.markPreviewHomeURLIfNeed()
  previewArticle(article)
  send(EVENT.RELOAD_ARTICLE)
}

export default () => {
  const s = useSalon()

  const articleNavi = useNaviArticle()

  return (
    <div className={s.wrapper}>
      {articleNavi?.previous && (
        <div
          className={cn(s.switchBlock, s.upBlock)}
          onClick={() => naviToArticle(articleNavi.previous)}
        >
          <ArrowSVG className={s.upArrow} />
          {/* <div className={cn(s.indexWrapper)}>
            <div className={s.upIndex}>上一篇</div>
          </div> */}
        </div>
      )}
      {articleNavi?.next && (
        <div
          className={cn(s.switchBlock, s.downBlock)}
          onClick={() => naviToArticle(articleNavi.next)}
        >
          <ArrowSVG className={s.downArrow} />
          {/* <div className={cn(s.indexWrapper)}>
            <div className={s.downIndex}>下一篇</div>
          </div> */}
        </div>
      )}
    </div>
  )
}
