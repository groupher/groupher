import { BANNER_LAYOUT, DASHBOARD_DESC_LAYOUT } from '~/const/layout'
import { callDashboardDesc } from '~/signal'
import useViewingCommunity from '~/hooks/useViewingCommunity'

import CheckLabel from '~/widgets/CheckLabel'
import ArrowButton from '~/widgets/Buttons/ArrowButton'

import { SETTING_FIELD } from '../constant'
import SectionLabel from '../SectionLabel'
import SavingBar from '../SavingBar'

import useBanner from '../logic/useBanner'
import useSalon, { cn } from '../salon/layout/banner_layout'

export default () => {
  const s = useSalon()

  const { edit, layout, getIsTouched, saving } = useBanner()
  const { title } = useViewingCommunity()

  const isTouched = getIsTouched()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title="整体布局"
        desc={
          <div className="row-center">
            整体页面的 Header 布局，适用于除文章页的所有页面。
            <ArrowButton onClick={() => callDashboardDesc(DASHBOARD_DESC_LAYOUT.POST_LIST)}>
              查看示例
            </ArrowButton>
          </div>
        }
      />
      <div className={s.select}>
        <div className={s.layout} onClick={() => edit(BANNER_LAYOUT.HEADER, 'bannerLayout')}>
          <div className={cn(s.block, layout === BANNER_LAYOUT.HEADER && s.blockActive)}>
            <h4 className={s.communityTitle}>{title}</h4>
            <div className={cn(s.bar, 'left-28 top-5')} />
            <div className={cn(s.circle, 'right-5 top-5')} />
            <div className={cn(s.hDivider, 'mt-1.5 mb-5')} />

            <div className="absolute w-full h-6 left-4 top-14">
              <div className={cn(s.bar, 'left-0 top-0 w-36')} />
              <div className={cn(s.bar, 'left-0 top-4 h-1 w-28 opacity-30')} />
            </div>

            <div className="absolute w-full h-6 left-4 top-24">
              <div className={cn(s.bar, 'left-0 top-0 w-28')} />
              <div className={cn(s.bar, 'left-0 top-4 h-1 w-24 opacity-30')} />
            </div>

            <div className="absolute w-full h-6 left-4 bottom-14">
              <div className={cn(s.bar, 'left-0 -top-1 w-24')} />
              <div className={cn(s.bar, 'left-0 top-3 h-1 w-32 opacity-30')} />
            </div>

            <div className="absolute w-full h-6 left-4 bottom-4">
              <div className={cn(s.bar, 'left-0 -top-1 w-32')} />
              <div className={cn(s.bar, 'left-0 top-3 h-1 w-28 opacity-30')} />
            </div>

            <div className={cn(s.vDivider, 'h-3/5 right-20 top-12')} />

            <div className={cn(s.bar, s.primaryBar, 'right-6 top-14 h-1 w-10 h-2.5')} />

            <div className={cn(s.bar, 'right-9 top-24 h-1 w-6 opacity-20')} />
            <div className={cn(s.bar, 'right-5 top-28 h-1 w-10 opacity-20')} />
            <div className={cn(s.bar, 'right-7 top-32 h-1 w-8 opacity-20')} />
            <div className={cn(s.bar, 'right-7 bottom-5 h-1 w-8 opacity-30')} />
          </div>
          <CheckLabel title="经典" active={layout === BANNER_LAYOUT.HEADER} top={4} />
        </div>
        <div className={s.layout} onClick={() => edit(BANNER_LAYOUT.TABBER, 'bannerLayout')}>
          <div className={cn(s.block, layout === BANNER_LAYOUT.TABBER && s.blockActive)}>
            <div className={cn(s.bar, 'left-2.5 top-2 w-11/12 h-10 opacity-10')} />
            <div className={cn(s.bar, 'left-4 top-8 w-10 h-10 opacity-30')} />
            <h4 className={cn(s.communityTitle, 'absolute top-14 left-16')}>{title}</h4>

            <div className="absolute w-full h-6 left-5 top-24">
              <div className={cn(s.bar, 'left-0 top-0 w-28')} />
              <div className={cn(s.bar, 'left-0 top-4 h-1 w-24 opacity-30')} />
            </div>

            <div className="absolute w-full h-6 left-5 bottom-14">
              <div className={cn(s.bar, 'left-0 -top-2 w-24')} />
              <div className={cn(s.bar, 'left-0 top-2 h-1 w-32 opacity-30')} />
            </div>

            <div className="absolute w-full h-6 left-5 bottom-6">
              <div className={cn(s.bar, 'left-0 top-0 w-32')} />
              <div className={cn(s.bar, 'left-0 top-4 h-1 w-28 opacity-30')} />
            </div>

            <div className={cn(s.bar, s.primaryBar, 'right-6 top-14 h-1 w-10 h-2.5')} />

            <div className={cn(s.bar, 'right-10 top-24 h-1 w-6 opacity-20')} />
            <div className={cn(s.bar, 'right-6 top-28 h-1 w-10 opacity-20')} />
            <div className={cn(s.bar, 'right-8 top-32 h-1 w-8 opacity-20')} />
            <div className={cn(s.bar, 'right-8 bottom-5 h-1 w-8 opacity-30')} />
          </div>
          <CheckLabel title="封面图" active={layout === BANNER_LAYOUT.TABBER} top={4} />
        </div>
        <div className={s.layout} onClick={() => edit(BANNER_LAYOUT.SIDEBAR, 'bannerLayout')}>
          <div className={cn(s.block, layout === BANNER_LAYOUT.SIDEBAR && s.blockActive)}>
            <h4 className={s.communityTitle}>{title}</h4>
            <div className={cn(s.bar, 'left-28 w-10 top-5')} />
            <div className={cn(s.circle, 'right-5 top-5')} />
            <div className={cn(s.bar, s.primaryBar, 'right-16 top-5 h-1 w-10 h-2.5')} />

            <div className="absolute w-3/5 h-6 right-2 top-12">
              <div className={cn(s.bar, 'left-0 top-0 w-28')} />
              <div className={cn(s.bar, 'left-0 top-4 h-1 w-28 opacity-30')} />
            </div>

            <div className="absolute w-3/5 h-6 right-2 top-20">
              <div className={cn(s.bar, 'left-0 top-1 w-28')} />
              <div className={cn(s.bar, 'left-0 top-5 h-1 w-24 opacity-30')} />
            </div>

            <div className="absolute w-3/5 h-6 right-2 bottom-20">
              <div className={cn(s.bar, 'left-0 top-0 w-24')} />
              <div className={cn(s.bar, 'left-0 top-4 h-1 w-32 opacity-30')} />
            </div>

            <div className="absolute w-3/5 h-6 right-2 bottom-10">
              <div className={cn(s.bar, 'left-0 top-0 w-20')} />
              <div className={cn(s.bar, 'left-0 top-4 h-1 w-28 opacity-30')} />
              <div className={cn(s.bar, 'left-0 top-8 w-16')} />
            </div>

            <div className={cn(s.vDivider, 'h-4/5 left-20 top-12')} />

            <div className={cn(s.bar, 'left-5 top-12 h-1 w-6 opacity-20')} />
            <div className={cn(s.bar, 'left-5 top-16 h-1 w-10 opacity-20')} />
            <div className={cn(s.bar, 'left-5 top-20 h-1 w-8 opacity-60')} />
            <div className={cn(s.bar, 'left-5 top-24 h-1 w-8 opacity-20')} />
            <div className={cn(s.bar, 'left-5 top-28 h-1 w-8 opacity-20')} />
            <div className={cn(s.bar, 'left-5 top-32 h-1 w-8 opacity-60')} />
            <div className={cn(s.bar, 'left-5 top-36 h-1 w-8 opacity-20')} />
            <div className={cn(s.bar, 'left-5 bottom-5 h-1 w-8 opacity-30')} />
          </div>
          <CheckLabel title="左右分栏" active={layout === BANNER_LAYOUT.SIDEBAR} top={4} />
        </div>
      </div>
      <SavingBar
        isTouched={isTouched}
        field={SETTING_FIELD.BANNER_LAYOUT}
        loading={saving}
        top={10}
        width="w-11/12"
      />
    </div>
  )
}
