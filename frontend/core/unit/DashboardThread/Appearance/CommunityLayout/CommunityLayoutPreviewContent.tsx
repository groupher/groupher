import { COMMUNITY_LAYOUT } from '~/const/layout'
import type { TCommunityLayout } from '~/spec'

import useSalon, { cnMerge } from './salon'

function ClassicContent({ title }: { title: string }) {
  const s = useSalon()

  return (
    <div className={s.frame}>
      <div className={s.nav}>
        <h4 className={s.communityTitle}>{title}</h4>
        <div className={cnMerge(s.bar, s.navBar)} />
        <div className={s.circle} />
      </div>
      <div className={cnMerge(s.hDivider, 'mt-1.5 mb-5')} />

      <div className={s.mainClassic}>
        <div className={s.contentColumn}>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitleWide)} />
            <div className={cnMerge(s.bar, s.contentDigest)} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitle)} />
            <div className={cnMerge(s.bar, s.contentDigestShort)} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitle)} />
            <div className={cnMerge(s.bar, s.contentDigestWide)} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitleWide)} />
            <div className={cnMerge(s.bar, s.contentDigestShort)} />
          </div>
        </div>

        <div className={s.vDivider} />

        <div className={s.rightRail}>
          <div className={cnMerge(s.bar, s.primaryBar, s.primaryChip)} />
          <div className={cnMerge(s.bar, s.railItemShort)} />
          <div className={cnMerge(s.bar, s.railItemWide)} />
          <div className={cnMerge(s.bar, s.railItem)} />
          <div className={cnMerge(s.bar, s.footerItem)} />
        </div>
      </div>
    </div>
  )
}

function HeroContent({ title }: { title: string }) {
  const s = useSalon()

  return (
    <div className={s.mainCover}>
      <div className={s.coverHero} />
      <div className={s.coverHeader}>
        <div className={s.coverLead}>
          <div className={cnMerge(s.bar, s.coverAvatar)} />
          <h4 className={s.communityTitle}>{title}</h4>
        </div>
        <div className={cnMerge(s.bar, s.primaryBar, s.primaryChip, s.coverAction)} />
      </div>

      <div className={s.coverContent}>
        <div className={s.coverMain}>
          <div className={s.coverSection}>
            <div className={cnMerge(s.bar, s.contentTitle)} />
            <div className={cnMerge(s.bar, s.coverBodyShort)} />
          </div>
          <div className={s.coverSection}>
            <div className={cnMerge(s.bar, s.contentTitle, 'w-1/2')} />
            <div className={cnMerge(s.bar, s.coverBodyLong)} />
          </div>
          <div className={s.coverSection}>
            <div className={cnMerge(s.bar, s.contentTitle)} />
            <div className={cnMerge(s.bar, s.coverBodyLong)} />
          </div>
          <div className={s.coverSection}>
            <div className={cnMerge(s.bar, s.contentTitle, 'w-1/2')} />
            <div className={cnMerge(s.bar, s.coverBodyLong, 'w-1/3')} />
          </div>
        </div>

        <div className={s.rightRail}>
          <div className={cnMerge(s.bar, s.railItemShort)} />
          <div className={cnMerge(s.bar, s.railItemWide)} />
          <div className={cnMerge(s.bar, s.railItem)} />
          <div className={cnMerge(s.bar, s.footerItem, 'mt-auto')} />
        </div>
      </div>
    </div>
  )
}

function SidebarContent({ title }: { title: string }) {
  const s = useSalon()

  return (
    <div className={s.frame}>
      <div className={s.nav}>
        <h4 className={s.communityTitle}>{title}</h4>
        <div className={s.navCenter}>
          <div className={cnMerge(s.bar, 'w-8')} />
          <div className={cnMerge(s.bar, s.primaryBar, s.primaryChip)} />
        </div>

        <div className={s.circle} />
      </div>

      <div className={s.mainSidebar}>
        <div className={s.sidebarNav}>
          <div className={cnMerge(s.bar, s.sideNavItem)} />
          <div className={cnMerge(s.bar, s.sideNavItemWide)} />
          <div className={cnMerge(s.bar, s.sideNavActive)} />
          <div className={cnMerge(s.bar, s.sideNavItem)} />
          <div className={cnMerge(s.bar, s.sideNavItem)} />
          <div className={cnMerge(s.bar, s.sideNavActive)} />
          <div className={cnMerge(s.bar, s.sideNavItem)} />
          <div className={cnMerge(s.bar, s.sidebarBottom, 'mt-auto')} />
        </div>

        <div className={s.vDivider} />

        <div className={s.sidebarMain}>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitle, 'w-1/2')} />
            <div className={cnMerge(s.bar, s.contentDigestShort)} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, s.contentTitle)} />
            <div className={cnMerge(s.bar, s.contentDigest)} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, 'w-24')} />
            <div className={cnMerge(s.bar, s.contentDigestShort)} />
            <div className={cnMerge(s.bar, 'w-16')} />
          </div>
          <div className={s.sectionBlock}>
            <div className={cnMerge(s.bar, 'w-24')} />
            <div className={cnMerge(s.bar, s.contentDigestShort)} />
            <div className={cnMerge(s.bar, 'w-16')} />
          </div>
        </div>
      </div>
    </div>
  )
}

type TProps = {
  layout: TCommunityLayout
  title: string
}

export default function CommunityLayoutPreviewContent({ layout, title }: TProps) {
  if (layout === COMMUNITY_LAYOUT.HERO) return <HeroContent title={title} />
  if (layout === COMMUNITY_LAYOUT.SIDEBAR) return <SidebarContent title={title} />
  return <ClassicContent title={title} />
}
