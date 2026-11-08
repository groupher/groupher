/*
 *
 * AuthorInfo
 *
 */

import { useArticleQueryContext } from '~/query/ArticleQueryProvider'
import Tabs from '~/ui/Switcher/Tabs'
import MentionsGraph from '~/unit/MentionsGraph'

import Activities from './Activities'
import { TAB_ACTIVITIES, TAB_ITEMS, TAB_MEMBERS, TAB_MENTIONS } from './constant'
import Members from './Members'
import useSalon from './salon'

// import { onFollow, undoFollow } from '../logic'

export default function ArticleFooter() {
  const s = useSalon()
  const context = useArticleQueryContext()
  if (!context) return null
  const { community, thread, innerId, mentionsFocus, footerTab: tab, setFooterTab } = context
  const articleFocus = { type: thread, articleInnerId: innerId } as typeof mentionsFocus

  return (
    <div id='article-footer' className={s.wrapper}>
      <div className={s.tabs}>
        <Tabs
          items={TAB_ITEMS}
          size='small'
          activeKey={tab}
          bottomSpace={0}
          onChange={(tab) => setFooterTab(tab as typeof context.footerTab)}
        />
      </div>
      <div className={s.content}>
        {tab === TAB_ACTIVITIES && <Activities />}
        {tab === TAB_MEMBERS && <Members />}
        {tab === TAB_MENTIONS && (
          <MentionsGraph
            community={community}
            focus={mentionsFocus ?? { type: thread, articleInnerId: innerId }}
            articleFocus={articleFocus}
            onFocusChange={context.showMentions}
          />
        )}
      </div>
    </div>
  )
}
