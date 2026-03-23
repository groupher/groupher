import { useState } from 'react'
import { BANNER_LAYOUT } from '~/const/layout'
import useCommunity from '~/stores/community/hooks'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'
import Drawer from '~/widgets/Drawer'

import { FIELD } from '../../constant'
import useBanner from '../../logic/useBanner'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn, cnMerge } from '../../salon/layout/banner_layout'

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
          <div className={cn(s.block, layout === BANNER_LAYOUT.HEADER && s.blockActive)}>
            <h4 className={cn(s.communityTitle)}>{title}</h4>
            <div className={cnMerge(s.bar, 'left-28 top-5')} />
            <div className={cnMerge(s.circle, 'right-5 top-5')} />
            <div className={cnMerge(s.hDivider, 'mt-1.5 mb-5')} />

            <div className='absolute w-full h-6 left-4 top-14'>
              <div className={cnMerge(s.bar, 'left-0 top-0 w-36')} />
              <div className={cnMerge(s.bar, 'left-0 top-4 h-1 w-28 opacity-30')} />
            </div>

            <div className='absolute w-full h-6 left-4 top-24'>
              <div className={cnMerge(s.bar, 'left-0 top-0 w-28')} />
              <div className={cnMerge(s.bar, 'left-0 top-4 h-1 w-24 opacity-30')} />
            </div>

            <div className='absolute w-full h-6 left-4 bottom-14'>
              <div className={cnMerge(s.bar, 'left-0 -top-1 w-24')} />
              <div className={cnMerge(s.bar, 'left-0 top-3 h-1 w-32 opacity-30')} />
            </div>

            <div className='absolute w-full h-6 left-4 bottom-4'>
              <div className={cnMerge(s.bar, 'left-0 -top-1 w-32')} />
              <div className={cnMerge(s.bar, 'left-0 top-3 h-1 w-28 opacity-30')} />
            </div>

            <div className={cnMerge(s.vDivider, 'h-3/5 right-20 top-12')} />

            <div className={cnMerge(s.bar, s.primaryBar, 'right-6 top-14 h-1 w-10 h-2.5')} />

            <div className={cnMerge(s.bar, 'right-9 top-24 h-1 w-6 opacity-20')} />
            <div className={cnMerge(s.bar, 'right-5 top-28 h-1 w-10 opacity-20')} />
            <div className={cnMerge(s.bar, 'right-7 top-32 h-1 w-8 opacity-20')} />
            <div className={cnMerge(s.bar, 'right-7 bottom-5 h-1 w-8 opacity-30')} />
          </div>
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
          <div className={cnMerge(s.block, layout === BANNER_LAYOUT.TABBER && s.blockActive)}>
            <div className={cnMerge(s.bar, 'left-2.5 top-2 w-11/12 h-10 opacity-10')} />
            <div className={cnMerge(s.bar, 'left-4 top-8 w-10 h-10 opacity-30')} />
            <h4 className={cnMerge(s.communityTitle, 'absolute top-14 left-16')}>{title}</h4>

            <div className='absolute w-full h-6 left-5 top-24'>
              <div className={cnMerge(s.bar, 'left-0 top-0 w-28')} />
              <div className={cnMerge(s.bar, 'left-0 top-4 h-1 w-24 opacity-30')} />
            </div>

            <div className='absolute w-full h-6 left-5 bottom-14'>
              <div className={cnMerge(s.bar, 'left-0 -top-2 w-24')} />
              <div className={cnMerge(s.bar, 'left-0 top-2 h-1 w-32 opacity-30')} />
            </div>

            <div className='absolute w-full h-6 left-5 bottom-6'>
              <div className={cnMerge(s.bar, 'left-0 top-0 w-32')} />
              <div className={cnMerge(s.bar, 'left-0 top-4 h-1 w-28 opacity-30')} />
            </div>

            <div className={cnMerge(s.bar, s.primaryBar, 'right-6 top-14 h-1 w-10 h-2.5')} />

            <div className={cnMerge(s.bar, 'right-10 top-24 h-1 w-6 opacity-20')} />
            <div className={cnMerge(s.bar, 'right-6 top-28 h-1 w-10 opacity-20')} />
            <div className={cnMerge(s.bar, 'right-8 top-32 h-1 w-8 opacity-20')} />
            <div className={cnMerge(s.bar, 'right-8 bottom-5 h-1 w-8 opacity-30')} />
          </div>
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
          <div className={cnMerge(s.block, layout === BANNER_LAYOUT.SIDEBAR && s.blockActive)}>
            <h4 className={s.communityTitle}>{title}</h4>
            <div className={cnMerge(s.bar, 'left-28 w-10 top-5')} />
            <div className={cnMerge(s.circle, 'right-5 top-5')} />
            <div className={cnMerge(s.bar, s.primaryBar, 'right-16 top-5 h-1 w-10 h-2.5')} />

            <div className='absolute w-3/5 h-6 right-2 top-12'>
              <div className={cnMerge(s.bar, 'left-0 top-0 w-28')} />
              <div className={cnMerge(s.bar, 'left-0 top-4 h-1 w-28 opacity-30')} />
            </div>

            <div className='absolute w-3/5 h-6 right-2 top-20'>
              <div className={cnMerge(s.bar, 'left-0 top-1 w-28')} />
              <div className={cnMerge(s.bar, 'left-0 top-5 h-1 w-24 opacity-30')} />
            </div>

            <div className='absolute w-3/5 h-6 right-2 bottom-20'>
              <div className={cnMerge(s.bar, 'left-0 top-0 w-24')} />
              <div className={cnMerge(s.bar, 'left-0 top-4 h-1 w-32 opacity-30')} />
            </div>

            <div className='absolute w-3/5 h-6 right-2 bottom-10'>
              <div className={cnMerge(s.bar, 'left-0 top-0 w-20')} />
              <div className={cnMerge(s.bar, 'left-0 top-4 h-1 w-28 opacity-30')} />
              <div className={cnMerge(s.bar, 'left-0 top-8 w-16')} />
            </div>

            <div className={cnMerge(s.vDivider, 'h-4/5 left-20 top-12')} />

            <div className={cnMerge(s.bar, 'left-5 top-12 h-1 w-6 opacity-20')} />
            <div className={cnMerge(s.bar, 'left-5 top-16 h-1 w-10 opacity-20')} />
            <div className={cnMerge(s.bar, 'left-5 top-20 h-1 w-8 opacity-60')} />
            <div className={cnMerge(s.bar, 'left-5 top-24 h-1 w-8 opacity-20')} />
            <div className={cnMerge(s.bar, 'left-5 top-28 h-1 w-8 opacity-20')} />
            <div className={cnMerge(s.bar, 'left-5 top-32 h-1 w-8 opacity-60')} />
            <div className={cnMerge(s.bar, 'left-5 top-36 h-1 w-8 opacity-20')} />
            <div className={cnMerge(s.bar, 'left-5 bottom-5 h-1 w-8 opacity-30')} />
          </div>
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
