/* *
 * KanbanThread
 *
 */

import type { ReactNode } from 'react'
import useKanbanPosts from '~/hooks/useKanbanPosts'
import useLayout from '~/hooks/useLayout'
import useNameAlias from '~/hooks/useNameAlias'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import GtdDoneSVG from '~/icons/GtdDone'
import GtdTodoSVG from '~/icons/GtdTodo'
import GtdWipSVG from '~/icons/GtdWip'
import RejectSVG from '~/icons/Reject'
import type { TKanbanBoard, TPagedPosts } from '~/spec'

import KanbanItem from '../KanbanItem'
import EmptyItem from '../KanbanItem/EmptyItem'

import useSalon, { cn } from '../salon/waterfall_layout/sections'

type TSection = {
  key: TKanbanBoard
  title: string
  countClassName: string
  headClassName: string
  icon: ReactNode
  posts: TPagedPosts
}

export default function Sections() {
  const { t } = useTrans()
  const { kanbanBoards } = useLayout()
  const kanbanAlias = useNameAlias('kanban')
  const {
    backlog: backlogPosts,
    todo: todoPosts,
    wip: wipPosts,
    done: donePosts,
    rejected: rejectedPosts,
  } = useKanbanPosts()

  const s = useSalon()
  const resolveTitle = (key: string, fallback: string) => kanbanAlias[key]?.name || fallback
  const sectionMap: Record<TKanbanBoard, TSection> = {
    backlog: {
      key: 'backlog',
      title: resolveTitle('backlog', t('article.state.backlog')),
      countClassName: s.backlogText,
      headClassName: s.backlogHead,
      icon: <GtdTodoSVG className={s.backlogIcon} />,
      posts: backlogPosts,
    },
    todo: {
      key: 'todo',
      title: resolveTitle('todo', t('article.state.todo')),
      countClassName: s.todoText,
      headClassName: s.todoHead,
      icon: <GtdTodoSVG className={s.todoIcon} />,
      posts: todoPosts,
    },
    wip: {
      key: 'wip',
      title: resolveTitle('wip', t('article.state.wip')),
      countClassName: s.wipText,
      headClassName: s.wipHead,
      icon: <GtdWipSVG className={s.wipIcon} />,
      posts: wipPosts,
    },
    done: {
      key: 'done',
      title: resolveTitle('done', t('article.state.done')),
      countClassName: s.doneText,
      headClassName: s.doneHead,
      icon: <GtdDoneSVG className={s.doneIcon} />,
      posts: donePosts,
    },
    rejected: {
      key: 'rejected',
      title: resolveTitle('rejected', t('article.state.reject')),
      countClassName: s.rejectedText,
      headClassName: s.rejectedHead,
      icon: <RejectSVG className={s.rejectedIcon} />,
      posts: rejectedPosts,
    },
  }
  const sections = kanbanBoards.map((board) => sectionMap[board]).filter(Boolean)

  return (
    <div className={s.wrapper}>
      {sections.map((section) => (
        <div key={section.key} className={s.column}>
          <div className={section.headClassName}>
            {section.icon}
            <div className={s.label}>{section.title}</div>
            <div className={cn(s.count, section.countClassName)}>{section.posts.totalCount} 项</div>
            <div className='grow' />
            <ArrowSVG className={s.arrowIcon} />
          </div>
          <div className={s.content}>
            {section.posts.totalCount === 0 && <EmptyItem />}
            {section.posts.totalCount !== 0 &&
              section.posts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
