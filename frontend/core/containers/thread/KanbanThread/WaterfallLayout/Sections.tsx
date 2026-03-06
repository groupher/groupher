/* *
 * KanbanThread
 *
 */

import useKanbanPosts from '~/hooks/useKanbanPosts'
import ArrowSVG from '~/icons/ArrowSimple'
import GtdDoneSVG from '~/icons/GtdDone'
import GtdTodoSVG from '~/icons/GtdTodo'
import GtdWipSVG from '~/icons/GtdWip'
import RejectSVG from '~/icons/Reject'

import KanbanItem from '~/widgets/KanbanItem'
import EmptyItem from '~/widgets/KanbanItem/EmptyItem'

import useSalon, { cn } from '../salon/waterfall_layout/sections'

export default () => {
  const {
    backlog: backlogPosts,
    todo: todoPosts,
    wip: wipPosts,
    done: donePosts,
    rejected: rejectedPosts,
  } = useKanbanPosts()

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.column}>
        <div className={s.backlogHead}>
          <GtdTodoSVG className={s.backlogIcon} />
          <div className={s.label}>需求池</div>
          <div className={cn(s.count, s.backlogText)}>{backlogPosts.totalCount} 项</div>
          <div className='grow' />
          <ArrowSVG className={s.arrowIcon} />
        </div>
        <div className={s.content}>
          {backlogPosts.totalCount === 0 && <EmptyItem />}
          {backlogPosts.totalCount !== 0 &&
            backlogPosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
      <div className={s.column}>
        <div className={s.todoHead}>
          <GtdTodoSVG className={s.todoIcon} />
          <div className={s.label}>待办</div>
          <div className={cn(s.count, s.todoText)}>{todoPosts.totalCount} 项</div>
          <div className='grow' />
          <ArrowSVG className={s.arrowIcon} />
        </div>
        <div className={s.content}>
          {todoPosts.totalCount === 0 && <EmptyItem />}
          {todoPosts.totalCount !== 0 &&
            todoPosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
      <div className={s.column}>
        <div className={s.wipHead}>
          <GtdWipSVG className={s.wipIcon} />
          <div className={s.label}>进行中</div>
          <div className={cn(s.count, s.wipText)}>{wipPosts.totalCount} 项</div>
          <div className='grow' />
          <ArrowSVG className={s.arrowIcon} />
        </div>
        <div className={s.content}>
          {wipPosts.totalCount === 0 && <EmptyItem />}

          {wipPosts.totalCount !== 0 &&
            wipPosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
      <div className={s.column}>
        <div className={s.doneHead}>
          <GtdDoneSVG className={s.doneIcon} />
          <div className={s.label}>已完成</div>
          <div className={cn(s.count, s.doneText)}>{donePosts.totalCount} 项</div>
          <div className='grow' />
          <ArrowSVG className={s.arrowIcon} />
        </div>
        <div className={s.content}>
          {donePosts.totalCount === 0 && <EmptyItem />}
          {donePosts.totalCount !== 0 &&
            donePosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
      <div className={s.column}>
        <div className={s.rejectedHead}>
          <RejectSVG className={s.rejectedIcon} />
          <div className={s.label}>已拒绝</div>
          <div className={cn(s.count, s.rejectedText)}>{rejectedPosts.totalCount} 项</div>
          <div className='grow' />
          <ArrowSVG className={s.arrowIcon} />
        </div>
        <div className={s.content}>
          {rejectedPosts.totalCount === 0 && <EmptyItem />}
          {rejectedPosts.totalCount !== 0 &&
            rejectedPosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
    </div>
  )
}
