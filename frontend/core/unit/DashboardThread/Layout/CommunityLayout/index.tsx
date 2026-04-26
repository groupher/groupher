import { useState } from 'react'

import { COMMUNITY_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import useCommunity from '~/stores/community/hooks'
import CheckLabel from '~/widgets/CheckLabel'
import Drawer from '~/widgets/Drawer'

import { FIELD } from '../../constant'
import useCommunityLayout from '../../logic/useCommunityLayout'
import useSalon, { cnMerge } from '../../salon/layout/community_layout'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import CommunityLayoutPreviewContent from './CommunityLayoutPreviewContent'

const COMMUNITY_LAYOUT_OPTIONS = [
  {
    value: COMMUNITY_LAYOUT.CLASSIC,
    titleKey: 'dsb.layout.community.option.classic',
  },
  {
    value: COMMUNITY_LAYOUT.HERO,
    titleKey: 'dsb.layout.community.option.hero',
  },
  {
    value: COMMUNITY_LAYOUT.SIDEBAR,
    titleKey: 'dsb.layout.community.option.sidebar',
  },
] as const

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
        onDetailClick={() => setShowDrawer(true)}
      />
      <div className={s.select}>
        {COMMUNITY_LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = layout === value

          return (
            <button
              key={value}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, FIELD.COMMUNITY_LAYOUT)}
            >
              <LayoutPreview isActive={isActive} title={title} layout={value} />
              <CheckLabel title={t(titleKey)} active={isActive} top={4} />
            </button>
          )
        })}
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.COMMUNITY_LAYOUT} top={10} />
    </div>
  )
}
