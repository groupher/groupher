import { useState } from 'react'
import { BANNER_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import useCommunity from '~/stores/community/hooks'
import CheckLabel from '~/widgets/CheckLabel'
import Drawer from '~/widgets/Drawer'

import { FIELD } from '../../constant'
import useBanner from '../../logic/useBanner'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn, cnMerge } from '../../salon/layout/banner_layout'

function HeaderPreview({ isActive, title }: { isActive: boolean; title: string }) {
  const s = useSalon()

  return (
    <div className={cn(s.block, isActive && s.blockActive)}>
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
    </div>
  )
}

function CoverPreview({ isActive, title }: { isActive: boolean; title: string }) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
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
    </div>
  )
}

function SidebarPreview({ isActive, title }: { isActive: boolean; title: string }) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
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
    </div>
  )
}

export default function BannerLayout() {
  const s = useSalon()
  const [showDrawer, setShowDrawer] = useState(false)
  const { t } = useTrans()

  const { edit, layout, isTouched, saving } = useBanner()
  const { title } = useCommunity()

  return (
    <div className={s.wrapper}>
      <Drawer show={showDrawer} onClose={() => setShowDrawer(false)}>
        <h2>{t('dsb.layout.banner.drawer_title')}</h2>
      </Drawer>

      <SectionLabel
        title={t('dsb.layout.banner.title')}
        desc={t('dsb.layout.banner.desc')}
        detailText={t('dsb.layout.view_example')}
      />
      <div className={s.select}>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === BANNER_LAYOUT.HEADER}
          onClick={() => edit(BANNER_LAYOUT.HEADER, FIELD.BANNER_LAYOUT)}
        >
          <HeaderPreview isActive={layout === BANNER_LAYOUT.HEADER} title={title} />
          <CheckLabel
            title={t('dsb.layout.banner.option.classic')}
            active={layout === BANNER_LAYOUT.HEADER}
            top={4}
          />
        </button>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === BANNER_LAYOUT.TABBER}
          onClick={() => edit(BANNER_LAYOUT.TABBER, FIELD.BANNER_LAYOUT)}
        >
          <CoverPreview isActive={layout === BANNER_LAYOUT.TABBER} title={title} />
          <CheckLabel
            title={t('dsb.layout.banner.option.cover')}
            active={layout === BANNER_LAYOUT.TABBER}
            top={4}
          />
        </button>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === BANNER_LAYOUT.SIDEBAR}
          onClick={() => edit(BANNER_LAYOUT.SIDEBAR, FIELD.BANNER_LAYOUT)}
        >
          <SidebarPreview isActive={layout === BANNER_LAYOUT.SIDEBAR} title={title} />
          <CheckLabel
            title={t('dsb.layout.banner.option.sidebar')}
            active={layout === BANNER_LAYOUT.SIDEBAR}
            top={4}
          />
        </button>
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.BANNER_LAYOUT} loading={saving} top={10} />
    </div>
  )
}
