/*
 *
 * AuthorInfo
 *
 */

import { useState } from 'react'

import Tabs from '~/widgets/Switcher/Tabs'

import Activities from './Activities'
import Members from './Members'

import { TAB_ITEMS, TAB_ACTIVITIES, TAB_MEMBERS } from './constant'
import useSalon from './salon'

// import { onFollow, undoFollow } from '../logic'

export default () => {
  const s = useSalon()

  const [tab, setTab] = useState(TAB_ACTIVITIES)

  return (
    <div className={s.wrapper}>
      <div className={s.tabs}>
        <Tabs items={TAB_ITEMS} size="small" activeKey={tab} onChange={(tab) => setTab(tab)} />
      </div>
      <div className={s.content}>
        {tab === TAB_ACTIVITIES && <Activities />}
        {tab === TAB_MEMBERS && <Members />}
      </div>
    </div>
  )
}
