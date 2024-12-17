import useNaviArticle from '~/hooks/useNaviArticle'

import ArrowSVG from '~/icons/ArrowSimple'

import useLogic from '../useLogic'
import useSalon, { cn } from '../styles/article_navi'

export default () => {
  const s = useSalon()

  const articleNavi = useNaviArticle()
  const { naviToArticle } = useLogic()

  return (
    <div className={s.wrapper}>
      {articleNavi?.previous && (
        <div
          className={cn(s.switchBlock, s.upBlock)}
          onClick={() => naviToArticle(articleNavi.previous)}
        >
          <ArrowSVG className={s.upArrow} />
          <div className={cn(s.indexWrapper)}>
            <div className={s.upIndex}>上一篇</div>
          </div>
        </div>
      )}
      {articleNavi?.next && (
        <div
          className={cn(s.switchBlock, s.downBlock)}
          onClick={() => naviToArticle(articleNavi.next)}
        >
          <ArrowSVG className={s.downArrow} />
          <div className={cn(s.indexWrapper)}>
            <div className={s.downIndex}>下一篇</div>
          </div>
        </div>
      )}
    </div>
  )
}
