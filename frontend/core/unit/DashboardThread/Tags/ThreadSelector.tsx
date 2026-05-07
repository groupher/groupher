import { THREAD, THREAD_PATH } from '~/const/thread'
import type { TTabItem, TTransKey } from '~/spec'
import { path2Thread } from '~/utils/thread'
import Tabs from '~/widgets/Switcher/Tabs'

import useTags from '../logic/useTags'
import useSalon from '../salon/tags/thread_selector'

const THREAD_TITLE_KEYS: Partial<Record<string, TTransKey>> = {
  [THREAD_PATH.POST]: 'dsb.widgets.threads.post.title',
  [THREAD_PATH.BLOG]: 'dsb.widgets.threads.blog.title',
  [THREAD_PATH.KANBAN]: 'dsb.widgets.threads.kanban.title',
  [THREAD_PATH.CHANGELOG]: 'dsb.widgets.threads.changelog.title',
  [THREAD_PATH.DOC]: 'dsb.widgets.threads.doc.title',
}

export default function ThreadSelector() {
  const s = useSalon()

  const { activeTagThread, changeThread, threads } = useTags()
  const active = activeTagThread || THREAD.POST
  const items: TTabItem[] = threads.map((thread) => ({
    slug: path2Thread(thread.slug),
    title: THREAD_TITLE_KEYS[thread.slug] || (thread.title as TTransKey),
  }))

  return (
    <div className={s.wrapper}>
      <Tabs
        items={items}
        activeKey={active}
        onChange={(thread) => changeThread(thread as typeof active)}
        left={-2}
      />
    </div>
  )
}
