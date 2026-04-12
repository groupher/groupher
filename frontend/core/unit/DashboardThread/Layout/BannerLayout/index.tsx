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
import useSalon, { cnMerge } from '../../salon/layout/banner_layout'
import BannerLayoutPreviewContent from './BannerLayoutPreviewContent'

function LayoutPreview({
  isActive,
  title,
  layout,
}: {
  isActive: boolean
  title: string
  layout: (typeof BANNER_LAYOUT)[keyof typeof BANNER_LAYOUT]
}) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <BannerLayoutPreviewContent layout={layout} title={title} />
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
          <LayoutPreview
            isActive={layout === BANNER_LAYOUT.HEADER}
            title={title}
            layout={BANNER_LAYOUT.HEADER}
          />
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
          <LayoutPreview
            isActive={layout === BANNER_LAYOUT.TABBER}
            title={title}
            layout={BANNER_LAYOUT.TABBER}
          />
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
          <LayoutPreview
            isActive={layout === BANNER_LAYOUT.SIDEBAR}
            title={title}
            layout={BANNER_LAYOUT.SIDEBAR}
          />
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
