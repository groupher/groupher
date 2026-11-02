/* *
 * KanbanThread
 *
 */

import type { ReactNode } from 'react'

import { KANBAN_BOARD } from '~/const/thread'
import useKanbanTickets, { type TKanbanPage } from '~/hooks/useKanbanTickets'
import useLayout from '~/hooks/useLayout'
import useNameAlias from '~/hooks/useNameAlias'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import GtdDoneSVG from '~/icons/GtdDone'
import GtdTodoSVG from '~/icons/GtdTodo'
import GtdWipSVG from '~/icons/GtdWip'
import type { TKanbanBoard, TTicketFilter } from '~/spec'

import KanbanItem from '../KanbanItem'
import EmptyItem from '../KanbanItem/EmptyItem'
import PageControls from '../PageControls'
import useSalon, { cn } from './salon/sections'

type TSection = {
  key: TKanbanBoard
  title: string
  countClassName: string
  headClassName: string
  icon: ReactNode
  posts: TKanbanPage
}

export default function Sections({
  internal = false,
  ticketFilter = {},
}: {
  internal?: boolean
  ticketFilter?: TTicketFilter
}) {
  const { t } = useTrans()
  const { kanbanBoards } = useLayout()
  const kanbanAlias = useNameAlias('kanban')
  const { todo, wip, done } = useKanbanTickets(internal, ticketFilter)

  const s = useSalon()
  const resolveTitle = (key: string, fallback: string) => kanbanAlias[key]?.name || fallback
  const sectionMap: Record<TKanbanBoard, TSection> = {
    [KANBAN_BOARD.TODO]: {
      key: KANBAN_BOARD.TODO,
      title: resolveTitle('todo', t('article.status.todo')),
      countClassName: s.todoText,
      headClassName: s.todoHead,
      icon: <GtdTodoSVG className={s.todoIcon} />,
      posts: todo,
    },
    [KANBAN_BOARD.WIP]: {
      key: KANBAN_BOARD.WIP,
      title: resolveTitle('wip', t('article.status.wip')),
      countClassName: s.wipText,
      headClassName: s.wipHead,
      icon: <GtdWipSVG className={s.wipIcon} />,
      posts: wip,
    },
    [KANBAN_BOARD.DONE]: {
      key: KANBAN_BOARD.DONE,
      title: resolveTitle('done', t('article.status.done')),
      countClassName: s.doneText,
      headClassName: s.doneHead,
      icon: <GtdDoneSVG className={s.doneIcon} />,
      posts: done,
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
            <div className={cn(s.count, section.countClassName)}>
              {section.posts.pageInfo?.__typename === 'OffsetPageInfo'
                ? section.posts.pageInfo.totalCount
                : section.posts.entries.length}{' '}
              项
            </div>
            <div className='grow' />
            <ArrowSVG className={s.arrowIcon} />
          </div>
          <div className={s.content}>
            {(section.posts.pageInfo?.__typename === 'OffsetPageInfo'
              ? section.posts.pageInfo.totalCount
              : section.posts.entries.length) === 0 && <EmptyItem />}
            {(section.posts.pageInfo?.__typename === 'OffsetPageInfo'
              ? section.posts.pageInfo.totalCount
              : section.posts.entries.length) !== 0 &&
              section.posts.entries.map((item) => (
                <KanbanItem key={item.content.id} viewModel={item} internal={internal} />
              ))}
            <PageControls page={section.posts} />
          </div>
        </div>
      ))}
    </div>
  )
}
