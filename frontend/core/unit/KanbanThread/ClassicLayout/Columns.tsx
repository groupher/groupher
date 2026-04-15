/* *
 * KanbanThread
 *
 */

import type { ReactNode, RefObject, UIEvent } from 'react'

import useKanbanPosts from '~/hooks/useKanbanPosts'
import useLayout from '~/hooks/useLayout'
import useNameAlias from '~/hooks/useNameAlias'
import useTrans from '~/hooks/useTrans'
import GtdDoneSVG from '~/icons/GtdDone'
import GtdTodoSVG from '~/icons/GtdTodo'
import GtdWipSVG from '~/icons/GtdWip'
import RejectSVG from '~/icons/Reject'
import { KANBAN_BOARD } from '~/const/thread'
import type { TKanbanBoard, TPagedPosts } from '~/spec'

import KanbanItem from '../KanbanItem'
import EmptyItem from '../KanbanItem/EmptyItem'

import useSalon from '../salon/classic_layout/columns'

type TColumn = {
  key: string
  count: number
  icon: ReactNode
  title: string
  bodyClassName: string
  posts: TPagedPosts
}

function HeaderColumn({ column, className = '' }: { column: TColumn; className?: string }) {
  const s = useSalon()

  return (
    <div className={className}>
      <div className={s.header}>
        {column.icon}
        <h4 className={s.label}>{column.title}</h4>
        <div className={s.subTitle}>{column.count}</div>
        <div className='grow' />
      </div>
    </div>
  )
}

function BodyColumn({ column, className = '' }: { column: TColumn; className?: string }) {
  const s = useSalon()
  const hasEntries = column.posts.entries.length > 0

  return (
    <div className={`${s.columnBase} ${className}`.trim()}>
      <div className={column.bodyClassName}>
        {!hasEntries && <EmptyItem />}
        {hasEntries &&
          column.posts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
      </div>
    </div>
  )
}

export function useColumnsData() {
  const s = useSalon()
  const { t } = useTrans()
  const kanbanAlias = useNameAlias('kanban')
  const { kanbanBoards } = useLayout()

  const {
    backlog: backlogPosts,
    todo: todoPosts,
    wip: wipPosts,
    done: donePosts,
    rejected: rejectedPosts,
  } = useKanbanPosts()

  const resolveTitle = (key: string, fallback: string) => kanbanAlias[key]?.name || fallback

  const columnMap: Record<TKanbanBoard, TColumn> = {
    [KANBAN_BOARD.BACKLOG]: {
      key: 'backlog',
      title: resolveTitle('backlog', t('article.state.backlog')),
      count: backlogPosts.totalCount,
      icon: <GtdTodoSVG className={s.backlogIcon} />,
      bodyClassName: s.backlogBody,
      posts: backlogPosts,
    },
    [KANBAN_BOARD.TODO]: {
      key: 'todo',
      title: resolveTitle('todo', t('article.state.todo')),
      count: todoPosts.totalCount,
      icon: <GtdTodoSVG className={s.todoIcon} />,
      bodyClassName: s.todoBody,
      posts: todoPosts,
    },
    [KANBAN_BOARD.WIP]: {
      key: 'wip',
      title: resolveTitle('wip', t('article.state.wip')),
      count: wipPosts.totalCount,
      icon: <GtdWipSVG className={s.wipIcon} />,
      bodyClassName: s.wipBody,
      posts: wipPosts,
    },
    [KANBAN_BOARD.DONE]: {
      key: 'done',
      title: resolveTitle('done', t('article.state.done')),
      count: donePosts.totalCount,
      icon: <GtdDoneSVG className={s.doneIcon} />,
      bodyClassName: s.doneBody,
      posts: donePosts,
    },
    [KANBAN_BOARD.REJECTED]: {
      key: 'rejected',
      title: resolveTitle('rejected', t('article.state.reject')),
      count: rejectedPosts.totalCount,
      icon: <RejectSVG className={s.rejectedIcon} />,
      bodyClassName: s.rejectedBody,
      posts: rejectedPosts,
    },
  }

  return kanbanBoards.map((board) => columnMap[board]).filter(Boolean)
}

export function HeaderRow({
  columns,
  trackRef,
  className = '',
}: {
  columns: TColumn[]
  trackRef?: RefObject<HTMLDivElement | null>
  className?: string
}) {
  const s = useSalon(columns.length)

  return (
    <div className={`${s.headerRowViewport} ${className}`.trim()}>
      <div ref={trackRef} className={s.columnsTrack}>
        {columns.map((column) => (
          <HeaderColumn key={column.key} column={column} className={s.scrollColumn} />
        ))}
      </div>
    </div>
  )
}

export function BodyRow({
  columns,
  scrollRef,
  onScroll,
}: {
  columns: TColumn[]
  scrollRef: RefObject<HTMLDivElement | null>
  onScroll: (event: UIEvent<HTMLDivElement>) => void
}) {
  const s = useSalon(columns.length)

  return (
    <div ref={scrollRef} className={s.scroller} onScroll={onScroll}>
      <div className={s.columnsTrack}>
        {columns.map((column) => (
          <BodyColumn key={column.key} column={column} className={s.scrollColumn} />
        ))}
      </div>
    </div>
  )
}
