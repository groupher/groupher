/*
 *
 * ClassicSidebar
 * common sidebar include community badge, publisher, tagsbar ads .. etc,
 * used for classic layout
 *
 */

import useCommunity from '~/stores/community/hooks'
import Img from '~/Img'
import { assetSrc } from '~/utils/helper'
import ImgFallback from '~/widgets/ImgFallback'

import useSalon from '../salon/thread_sidebar/community_brief'

export default function CommunityBrief() {
  const { logo, title, meta, subscribersCount } = useCommunity()

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Img
        className={s.logo}
        src={assetSrc(logo)}
        fallback={<ImgFallback top={-1.5} title={title} />}
        noLazy
      />

      <section className={s.brief}>
        <h3 className={s.title}>{title}</h3>
        <div className={s.row}>
          <div className={s.label}>关注</div>
          <div className={s.count}>{subscribersCount}</div>
          <div className='mr-4' />
          <div className={s.label}>帖子</div>
          <div className={s.count}>{meta?.postsCount}</div>
        </div>
      </section>
    </div>
  )
}
