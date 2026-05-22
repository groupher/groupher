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
import LayoutPreview from './LayoutPreview'
import useSalon from './salon'

const COMMUNITY_LAYOUT_OPTIONS = [
  {
    value: COMMUNITY_LAYOUT.CLASSIC,
    titleKey: 'dsb.appearance.community.option.classic',
  },
  {
    value: COMMUNITY_LAYOUT.HERO,
    titleKey: 'dsb.appearance.community.option.hero',
  },
  {
    value: COMMUNITY_LAYOUT.SIDEBAR,
    titleKey: 'dsb.appearance.community.option.sidebar',
  },
] as const

export default function CommunityLayout() {
  const s = useSalon()
  const [showDrawer, setShowDrawer] = useState(false)
  const { t } = useTrans()

  const { edit, layout, isTouched } = useCommunityLayout()
  const { title } = useCommunity()

  return (
    <div className={s.wrapper}>
      <Drawer show={showDrawer} onClose={() => setShowDrawer(false)}>
        <h2>{t('dsb.appearance.community.drawer_title')}</h2>
      </Drawer>

      <SectionLabel
        title={t('dsb.appearance.community.title')}
        desc={t('dsb.appearance.community.desc')}
        detailText={t('dsb.appearance.view_example')}
        touched={isTouched}
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
