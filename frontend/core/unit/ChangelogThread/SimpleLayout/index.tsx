/* *
 * ChangelogThread
 *
 */

import { useState } from 'react'

import usePagedChangelogs from '~/hooks/usePagedChangelogs'
import Tabs from '~/widgets/Switcher/Tabs'

import ChangelogItem from '../ChangelogItem'
import { TABS_MODE_OPTIONS } from '../constant'
import useSalon from '../salon/simple_layout'
import type { TTagsMode } from '../spec'
import FilterBar from './FilterBar'

export default function SimpleLayout() {
  const s = useSalon()
  const { pagedChangelogs } = usePagedChangelogs()

  const [filterExpand, setFilterExpand] = useState(false)
  const [tab, setTab] = useState<TTagsMode>(TABS_MODE_OPTIONS[0].slug)

  return (
    <div className={s.wrapper}>
      <div className={s.banner}>
        <h2 className={s.title}>更新日志</h2>
        <div className={s.desc}>Groupher 的功能更新，界面调整，性能与 Bug 修复等</div>
        <div className={s.tabs}>
          <Tabs
            items={TABS_MODE_OPTIONS}
            size='small'
            activeKey={tab}
            bottomSpace={0}
            onChange={(slug) => {
              const nextTab = slug as TTagsMode
              setTab(nextTab)

              if (nextTab === TABS_MODE_OPTIONS[0].slug) {
                return setFilterExpand(false)
              }
              setFilterExpand(true)
            }}
          />
        </div>
        <div className={s.divider} />
      </div>

      {filterExpand && <FilterBar tab={tab} />}
      <div className={s.main}>
        {pagedChangelogs?.entries.map((item) => (
          <ChangelogItem key={item.innerId} article={item} />
        ))}
      </div>
    </div>
  )
}
