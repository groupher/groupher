import { CHANGELOG_LAYOUT } from '~/const/layout'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../constant'
import useChangelog from '../logic/useChangelog'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon, { cnMerge } from '../salon/layout/changelog_layout'

export default () => {
  const s = useSalon()
  const { edit, layout, isTouched, saving } = useChangelog()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title='更新日志布局'
        desc='「更新日志」列表的默认展现形式，切换布局不影响已发布内容。'
        detailText='查看示例'
      />
      <div className={s.select}>
        <button
          className={s.layout}
          onClick={() => edit(CHANGELOG_LAYOUT.CLASSIC, 'changelogLayout')}
        >
          <div className={cnMerge(s.block, layout === CHANGELOG_LAYOUT.CLASSIC && s.blockActive)}>
            <div className={cnMerge(s.cover, 'left-16')} />
            <div className={cnMerge(s.bar, 'h-2.5 top-28 left-16 ml-0.5 opacity-30')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-32 left-16 ml-0.5 mt-2 w-32 opacity-20')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-36 left-16 ml-0.5 mt-2 w-28 opacity-10')} />

            <div className={cnMerge(s.cover, 'left-16 bottom-16')} />
            <div className={cnMerge(s.bar, 'h-2.5 w-14 bottom-10 left-16 ml-0.5 opacity-30')} />
            <div className={cnMerge(s.bar, 'h-1.5 bottom-6 left-16 ml-0.5 mt-2 w-28 opacity-15')} />
          </div>

          <CheckLabel title='经典模式' active={layout === CHANGELOG_LAYOUT.CLASSIC} top={4} />
        </button>
        <button
          className={s.layout}
          onClick={() => edit(CHANGELOG_LAYOUT.SIMPLE, 'changelogLayout')}
        >
          <div className={cnMerge(s.block, layout === CHANGELOG_LAYOUT.SIMPLE && s.blockActive)}>
            <div className={cnMerge(s.bar, 'h-1.5 w-7 top-5 mt-0.5 left-10 ml-0.5 opacity-20')} />
            <div className={cnMerge(s.bar, 'h-2.5 top-5 left-24 ml-0.5 opacity-30')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-10 left-24 ml-0.5 mt-2 w-28 opacity-30')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-14 left-24 ml-0.5 mt-2 w-24 opacity-20')} />

            <div className={cnMerge(s.thumbnil, 'top-20 left-24')} />
            <div className={cnMerge(s.thumbnil, 'top-20 left-36 ml-2')} />

            <div className={cnMerge(s.bar, 'h-1.5 w-7 top-36 mt-0.5 left-10 ml-0.5 opacity-20')} />
            <div className={cnMerge(s.bar, 'h-2.5 w-16 top-36 left-24 ml-0.5 opacity-30')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-40 left-24 ml-0.5 mt-2 w-24 opacity-30')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-44 left-24 ml-0.5 mt-2 w-28 opacity-20')} />
            <div className={cnMerge(s.bar, 'h-1.5 top-48 left-24 ml-0.5 mt-2 w-16 opacity-10')} />

            <div className={cnMerge(s.thumbnil, 'top-52 mt-2.5 left-24')} />
            <div className={cnMerge(s.thumbnil, 'top-52 mt-2.5 left-36 ml-2')} />

            <div
              className={cnMerge(s.bar, 'h-1.5 w-8 bottom-6 mt-0.5 left-10 ml-0.5 opacity-20')}
            />
            <div className={cnMerge(s.bar, 'h-2.5 w-16 bottom-6 left-24 ml-0.5 opacity-30')} />
          </div>

          <CheckLabel title='极简模式' active={layout === CHANGELOG_LAYOUT.SIMPLE} top={4} />
        </button>
      </div>

      <SavingBar
        isTouched={isTouched}
        field={FIELD.CHANGELOG_LAYOUT}
        loading={saving}
        width='w-11/12'
        top={12}
      />
    </div>
  )
}
