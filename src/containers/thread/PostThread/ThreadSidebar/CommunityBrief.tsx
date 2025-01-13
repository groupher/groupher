/*
 *
 * ClassicSidebar
 * common sidebar include community badge, publisher, tagsbar ads .. etc,
 * used for classic layout
 *
 */

import useViewingCommunity from '~/hooks/useViewingCommunity'
import { assetSrc } from '~/utils/helper'

import { Space } from '~/widgets/Common'
import ImgFallback from '~/widgets/ImgFallback'
import Img from '~/Img'

import useSalon from '../salon/thread_sidebar/community_brief'

export default () => {
  const { logo, title, meta, subscribersCount } = useViewingCommunity()

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Img
        className={s.logo}
        src={assetSrc(logo)}
        fallback={<ImgFallback size={8} top={-1.5} title={title} />}
        noLazy
      />

      <section className={s.brief}>
        <h3 className={s.title}>{title}</h3>
        <div className={s.row}>
          <div className={s.label}>关注</div>
          <div className={s.count}>{subscribersCount}</div>
          <Space right={15} />
          <div className={s.label}>帖子</div>
          <div className={s.count}>{meta?.postsCount}</div>
        </div>
      </section>
    </div>
  )
}
