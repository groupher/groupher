/* *
 * KanbanThread
 *
 */

import type { ReactNode } from 'react'

import { KANBAN_BOARD } from '~/const/thread'
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
    [KANBAN_BOARD.BACKLOG]: {
      key: KANBAN_BOARD.BACKLOG,
      title: resolveTitle('backlog', t('article.status.backlog')),
      countClassName: s.backlogText,
      headClassName: s.backlogHead,
      icon: <GtdTodoSVG className={s.backlogIcon} />,
      posts: backlogPosts,
    },
    [KANBAN_BOARD.TODO]: {
      key: KANBAN_BOARD.TODO,
      title: resolveTitle('todo', t('article.status.todo')),
      countClassName: s.todoText,
      headClassName: s.todoHead,
      icon: <GtdTodoSVG className={s.todoIcon} />,
      posts: todoPosts,
    },
    [KANBAN_BOARD.WIP]: {
      key: KANBAN_BOARD.WIP,
      title: resolveTitle('wip', t('article.status.wip')),
      countClassName: s.wipText,
      headClassName: s.wipHead,
      icon: <GtdWipSVG className={s.wipIcon} />,
      posts: wipPosts,
    },
    [KANBAN_BOARD.DONE]: {
      key: KANBAN_BOARD.DONE,
      title: resolveTitle('done', t('article.status.done')),
      countClassName: s.doneText,
      headClassName: s.doneHead,
      icon: <GtdDoneSVG className={s.doneIcon} />,
      posts: donePosts,
    },
    [KANBAN_BOARD.REJECTED]: {
      key: KANBAN_BOARD.REJECTED,
      title: resolveTitle('rejected', t('article.status.reject')),
      countClassName: s.rejectedText,
      headClassName: s.rejectedHead,
      icon: <RejectSVG className={s.rejectedIcon} />,
      posts: rejectedPosts,
    },
  }
  const sections = kanbanBoards.flatMap((board) => sectionMap[board] || [])

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
