import { useState } from 'react'

import type { TThread } from '~/spec'
import { THREAD } from '~/const/thread'

import Tabs from './Tabs'
import Content from './Content'

import useSalon from '../salon/articles_intro_tabs'

export default () => {
  const s = useSalon()
  const [tab, setTab] = useState<TThread>(THREAD.POST)

  return (
    <div className={s.wrapper}>
      <Tabs tab={tab} onChange={(tab) => setTab(tab)} />
      <Content tab={tab} />
    </div>
  )
}
