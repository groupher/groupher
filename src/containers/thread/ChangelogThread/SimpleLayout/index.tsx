/* *
 * ChangelogThread
 *
 */

import { useState } from 'react'

import useLayout from '~/hooks/useLayout'
import usePagedChangelogs from '~/hooks/usePagedChangelogs'
import { CHANGELOG_LAYOUT } from '~/const/layout'

import ChangelogItem from '~/widgets/ChangelogItem'
import Tabs from '~/widgets/Switcher/Tabs'

import { TABS_MODE_OPTIONS } from '../constant'
import FilterBar from './FilterBar'

import useSalon from '../styles/simple_layout'

export default () => {
  const s = useSalon()
  const { pagedChangelogs } = usePagedChangelogs()
  const { changelogLayout } = useLayout()

  const [filterExpand, setFilterExpand] = useState(false)
  const [tab, setTab] = useState(TABS_MODE_OPTIONS[0].slug)

  const alignLeft = changelogLayout === CHANGELOG_LAYOUT.SIMPLE

  return (
    <div className={s.wrapper}>
      <div className={s.banner}>
        <h2 className={s.title}>更新日志</h2>
        <div className={s.desc}>Groupher 的功能更新，界面调整，性能与 Bug 修复等</div>
        <div className={s.tabs}>
          <Tabs
            items={TABS_MODE_OPTIONS}
            size="small"
            activeKey={tab}
            bottomSpace={0}
            onChange={(slug) => {
              setTab(slug)

              if (slug === TABS_MODE_OPTIONS[0].slug) {
                return setFilterExpand(false)
              }
              setFilterExpand(true)
            }}
          />
        </div>
        <div className={s.divider} />
      </div>

      {filterExpand && <FilterBar tab={tab} alignLeft={alignLeft} />}
      <div className={s.main}>
        {pagedChangelogs.entries.map((item) => (
          <ChangelogItem key={item.innerId} article={item} />
        ))}
      </div>
    </div>
  )
}
