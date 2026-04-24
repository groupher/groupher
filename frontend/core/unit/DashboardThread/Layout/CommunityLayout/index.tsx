import { useState } from 'react'
import { COMMUNITY_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import useCommunity from '~/stores/community/hooks'
import CheckLabel from '~/widgets/CheckLabel'
import Drawer from '~/widgets/Drawer'

import { FIELD } from '../../constant'
import useCommunityLayout from '../../logic/useCommunityLayout'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cnMerge } from '../../salon/layout/community_layout'
import CommunityLayoutPreviewContent from './CommunityLayoutPreviewContent'

function LayoutPreview({
  isActive,
  title,
  layout,
}: {
  isActive: boolean
  title: string
  layout: (typeof COMMUNITY_LAYOUT)[keyof typeof COMMUNITY_LAYOUT]
}) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <CommunityLayoutPreviewContent layout={layout} title={title} />
    </div>
  )
}

export default function CommunityLayout() {
  const s = useSalon()
  const [showDrawer, setShowDrawer] = useState(false)
  const { t } = useTrans()

  const { edit, layout, isTouched } = useCommunityLayout()
  const { title } = useCommunity()

  return (
    <div className={s.wrapper}>
      <Drawer show={showDrawer} onClose={() => setShowDrawer(false)}>
        <h2>{t('dsb.layout.community.drawer_title')}</h2>
      </Drawer>

      <SectionLabel
        title={t('dsb.layout.community.title')}
        desc={t('dsb.layout.community.desc')}
        detailText={t('dsb.layout.view_example')}
      />
      <div className={s.select}>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === COMMUNITY_LAYOUT.CLASSIC}
          onClick={() => edit(COMMUNITY_LAYOUT.CLASSIC, FIELD.COMMUNITY_LAYOUT)}
        >
          <LayoutPreview
            isActive={layout === COMMUNITY_LAYOUT.CLASSIC}
            title={title}
            layout={COMMUNITY_LAYOUT.CLASSIC}
          />
          <CheckLabel
            title={t('dsb.layout.community.option.classic')}
            active={layout === COMMUNITY_LAYOUT.CLASSIC}
            top={4}
          />
        </button>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === COMMUNITY_LAYOUT.HERO}
          onClick={() => edit(COMMUNITY_LAYOUT.HERO, FIELD.COMMUNITY_LAYOUT)}
        >
          <LayoutPreview
            isActive={layout === COMMUNITY_LAYOUT.HERO}
            title={title}
            layout={COMMUNITY_LAYOUT.HERO}
          />
          <CheckLabel
            title={t('dsb.layout.community.option.hero')}
            active={layout === COMMUNITY_LAYOUT.HERO}
            top={4}
          />
        </button>
        <button
          type='button'
          className={s.layout}
          aria-pressed={layout === COMMUNITY_LAYOUT.SIDEBAR}
          onClick={() => edit(COMMUNITY_LAYOUT.SIDEBAR, FIELD.COMMUNITY_LAYOUT)}
        >
          <LayoutPreview
            isActive={layout === COMMUNITY_LAYOUT.SIDEBAR}
            title={title}
            layout={COMMUNITY_LAYOUT.SIDEBAR}
          />
          <CheckLabel
            title={t('dsb.layout.community.option.sidebar')}
            active={layout === COMMUNITY_LAYOUT.SIDEBAR}
            top={4}
          />
        </button>
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.COMMUNITY_LAYOUT} top={10} />
    </div>
  )
}
