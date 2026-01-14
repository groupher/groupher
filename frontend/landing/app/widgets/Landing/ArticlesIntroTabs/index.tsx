import { useState } from 'react'
import { THREAD } from '~/const/thread'
import type { TThread } from '~/spec'
import useSalon from '../salon/articles_intro_tabs'
import Content from './Content'
import Tabs from './Tabs'

export default function ArticlesIntroTabs() {
  const s = useSalon()
  const [tab, setTab] = useState<TThread>(THREAD.POST)

  return (
    <section className={s.wrapper}>
      <Tabs tab={tab} onChange={(tab) => setTab(tab)} />
      <Content tab={tab} />
    </section>
  )
}
