import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { BANNER_LAYOUT, BRAND_LAYOUT } from '~/const/layout'
import { THREAD } from '~/const/thread'
import { prettyURL } from '~/fmt'
import { assetSrc } from '~/helper'
import useCommunity from '~/stores/community/hooks'
import useLayout from '~/hooks/useLayout'
import useViewingThread from '~/hooks/useViewingThread'
import Img from '~/Img'
import LinkSVG from '~/icons/Link'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import ImgFallback from '~/widgets/ImgFallback'

import useSalon from '../salon/sidebar_layout/community_brief'

export default function CommunityBrief() {
  const s = useSalon()

  const router = useRouter()
  const { logo, slug, title, desc, dashboard } = useCommunity()
  const activeThread = useViewingThread()
  const { bannerLayout, brandLayout } = useLayout()

  const { baseInfo } = dashboard

  return (
    <div className={s.wrapper}>
      {brandLayout !== BRAND_LAYOUT.TEXT && (
        <div className={s.logoBox}>
          <Img src={assetSrc(logo)} className={s.logo} fallback={<ImgFallback title={title} />} />
        </div>
      )}

      {brandLayout !== BRAND_LAYOUT.LOGO && <h2 className={s.title}>{title}</h2>}
      <div className={s.desc}>{desc}</div>

      {bannerLayout === BANNER_LAYOUT.SIDEBAR && activeThread === THREAD.DOC && (
        <ArrowButton top={12} left={-2} leftLayout onClick={() => router.push(`/${slug}`)}>
          返回社区
        </ArrowButton>
      )}

      {baseInfo.homepage && (
        <div className={s.homeLink}>
          <div className={s.linkIconBox}>
            <LinkSVG className={s.linkIcon} />
          </div>
          <Link href={baseInfo.homepage} className={s.link}>
            {prettyURL(baseInfo.homepage)}
          </Link>
        </div>
      )}
    </div>
  )
}
