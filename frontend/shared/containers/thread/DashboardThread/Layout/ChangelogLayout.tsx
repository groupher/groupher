import { CHANGELOG_LAYOUT, DASHBOARD_DESC_LAYOUT } from '~/const/layout'
import { callDashboardDesc } from '~/signal'

import ArrowButton from '~/widgets/Buttons/ArrowButton'
import CheckLabel from '~/widgets/CheckLabel'

import { SETTING_FIELD } from '../constant'
import SectionLabel from '../SectionLabel'
import SavingBar from '../SavingBar'

import useChangelog from '../logic/useChangelog'
import useSalon, { cn } from '../salon/layout/changelog_layout'

export default () => {
  const s = useSalon()
  const { edit, layout, getIsTouched, saving } = useChangelog()
  const isTouched = getIsTouched()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title="更新日志布局"
        desc={
          <>
            「更新日志」列表的默认展现形式，切换布局不影响已发布内容。
            <div className="inline-flex">
              <ArrowButton
                onClick={() => callDashboardDesc(DASHBOARD_DESC_LAYOUT.POST_LIST)}
                fontSize={12}
              >
                查看示例
              </ArrowButton>
            </div>
          </>
        }
      />
      <div className={s.select}>
        <div className={s.layout} onClick={() => edit(CHANGELOG_LAYOUT.CLASSIC, 'changelogLayout')}>
          <div className={cn(s.block, layout === CHANGELOG_LAYOUT.CLASSIC && s.blockActive)}>
            <div className={cn(s.cover, 'left-16')} />
            <div className={cn(s.bar, 'h-2.5 top-28 left-16 ml-0.5 opacity-30')} />
            <div className={cn(s.bar, 'h-1.5 top-32 left-16 ml-0.5 mt-2 w-32 opacity-20')} />
            <div className={cn(s.bar, 'h-1.5 top-36 left-16 ml-0.5 mt-2 w-28 opacity-10')} />

            <div className={cn(s.cover, 'left-16 bottom-16')} />
            <div className={cn(s.bar, 'h-2.5 w-14 bottom-10 left-16 ml-0.5 opacity-30')} />
            <div className={cn(s.bar, 'h-1.5 bottom-6 left-16 ml-0.5 mt-2 w-28 opacity-15')} />
          </div>

          <CheckLabel title="经典模式" active={layout === CHANGELOG_LAYOUT.CLASSIC} top={4} />
        </div>
        <div className={s.layout} onClick={() => edit(CHANGELOG_LAYOUT.SIMPLE, 'changelogLayout')}>
          <div className={cn(s.block, layout === CHANGELOG_LAYOUT.SIMPLE && s.blockActive)}>
            <div className={cn(s.bar, 'h-1.5 w-7 top-5 mt-0.5 left-10 ml-0.5 opacity-20')} />
            <div className={cn(s.bar, 'h-2.5 top-5 left-24 ml-0.5 opacity-30')} />
            <div className={cn(s.bar, 'h-1.5 top-10 left-24 ml-0.5 mt-2 w-28 opacity-30')} />
            <div className={cn(s.bar, 'h-1.5 top-14 left-24 ml-0.5 mt-2 w-24 opacity-20')} />

            <div className={cn(s.thumbnil, 'top-20 left-24')} />
            <div className={cn(s.thumbnil, 'top-20 left-36 ml-2')} />

            <div className={cn(s.bar, 'h-1.5 w-7 top-36 mt-0.5 left-10 ml-0.5 opacity-20')} />
            <div className={cn(s.bar, 'h-2.5 w-16 top-36 left-24 ml-0.5 opacity-30')} />
            <div className={cn(s.bar, 'h-1.5 top-40 left-24 ml-0.5 mt-2 w-24 opacity-30')} />
            <div className={cn(s.bar, 'h-1.5 top-44 left-24 ml-0.5 mt-2 w-28 opacity-20')} />
            <div className={cn(s.bar, 'h-1.5 top-48 left-24 ml-0.5 mt-2 w-16 opacity-10')} />

            <div className={cn(s.thumbnil, 'top-52 mt-2.5 left-24')} />
            <div className={cn(s.thumbnil, 'top-52 mt-2.5 left-36 ml-2')} />

            <div className={cn(s.bar, 'h-1.5 w-8 bottom-6 mt-0.5 left-10 ml-0.5 opacity-20')} />
            <div className={cn(s.bar, 'h-2.5 w-16 bottom-6 left-24 ml-0.5 opacity-30')} />
          </div>

          <CheckLabel title="极简模式" active={layout === CHANGELOG_LAYOUT.SIMPLE} top={4} />
        </div>
      </div>

      <SavingBar
        isTouched={isTouched}
        field={SETTING_FIELD.CHANGELOG_LAYOUT}
        loading={saving}
        width="w-11/12"
        top={12}
      />
    </div>
  )
}
