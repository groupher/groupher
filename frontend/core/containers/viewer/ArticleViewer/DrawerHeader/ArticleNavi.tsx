import { useRouter } from 'next/navigation'
import useCommunity from '~/hooks/useCommunity'

import useNaviArticle from '~/hooks/useNaviArticle'

import ArrowSVG from '~/icons/ArrowSimple'

import useSalon, { cn } from '../salon/drawer_header/article_navi'

export default function ArticleNavi() {
  const s = useSalon()
  const router = useRouter()
  const { slug } = useCommunity()

  const articleNavi = useNaviArticle()

  return (
    <div className={s.wrapper}>
      {articleNavi?.previous && (
        <button
          className={cn(s.switchBlock, s.upBlock)}
          onClick={() =>
            router.push(
              `/${slug}/${articleNavi.previous.meta.thread.toLowerCase()}/${articleNavi.previous.innerId}`,
              {
                scroll: false,
              },
            )
          }
        >
          <ArrowSVG className={s.upArrow} />
          {/* <div className={cn(s.indexWrapper)}>
            <div className={s.upIndex}>上一篇</div>
          </div> */}
        </button>
      )}
      {articleNavi?.next && (
        <button
          className={cn(s.switchBlock, s.downBlock)}
          onClick={() =>
            router.push(
              `/${slug}/${articleNavi.next.meta.thread.toLowerCase()}/${articleNavi.next.innerId}`,
              {
                scroll: false,
              },
            )
          }
        >
          <ArrowSVG className={s.downArrow} />
          {/* <div className={cn(s.indexWrapper)}>
            <div className={s.downIndex}>下一篇</div>
          </div> */}
        </button>
      )}
    </div>
  )
}
