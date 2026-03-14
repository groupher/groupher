/* *
 * KanbanThread
 *
 */

import useKanbanPosts from '~/hooks/useKanbanPosts'
import GtdDoneSVG from '~/icons/GtdDone'
import GtdTodoSVG from '~/icons/GtdTodo'
import GtdWipSVG from '~/icons/GtdWip'
import RejectSVG from '~/icons/Reject'

import KanbanItem from '~/widgets/KanbanItem'
import EmptyItem from '~/widgets/KanbanItem/EmptyItem'

import useSalon from '../salon/classic_layout/columns'

export default function Columns() {
  const s = useSalon()

  const {
    backlog: backlogPosts,
    todo: todoPosts,
    wip: wipPosts,
    done: donePosts,
    rejected: rejectedPosts,
  } = useKanbanPosts()

  return (
    <>
      <div className={s.column}>
        <div className={s.header}>
          <GtdTodoSVG className={s.backlogIcon} />
          <h4 className={s.label}>需求池</h4>
          <div className={s.subTitle}>{backlogPosts.totalCount}</div>
          <div className='grow' />
        </div>
        <div className={s.backlogBody}>
          {backlogPosts.totalCount === 0 && <EmptyItem />}
          {backlogPosts.totalCount !== 0 &&
            backlogPosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
      <div className={s.column}>
        <div className={s.header}>
          <GtdTodoSVG className={s.todoIcon} />
          <h4 className={s.label}>待办</h4>
          <div className={s.subTitle}>{todoPosts.totalCount}</div>
          <div className='grow' />
        </div>
        <div className={s.todoBody}>
          {todoPosts.totalCount === 0 && <EmptyItem />}
          {todoPosts.totalCount !== 0 &&
            todoPosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
      <div className={s.column}>
        <div className={s.header}>
          <GtdWipSVG className={s.wipIcon} />
          <h4 className={s.label}>进行中</h4>
          <div className={s.subTitle}>{wipPosts.totalCount}</div>
          <div className='grow' />
        </div>
        <div className={s.wipBody}>
          {wipPosts.totalCount === 0 && <EmptyItem />}

          {wipPosts.totalCount !== 0 &&
            wipPosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
      <div className={s.column}>
        <div className={s.header}>
          <GtdDoneSVG className={s.doneIcon} />
          <h4 className={s.label}>已完成</h4>
          <div className={s.subTitle}>{donePosts.totalCount}</div>
          <div className='grow' />
        </div>
        <div className={s.doneBody}>
          {donePosts.totalCount === 0 && <EmptyItem />}

          {donePosts.totalCount !== 0 &&
            donePosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
      <div className={s.column}>
        <div className={s.header}>
          <RejectSVG className={s.rejectedIcon} />
          <h4 className={s.label}>已拒绝</h4>
          <div className={s.subTitle}>{rejectedPosts.totalCount}</div>
          <div className='grow' />
        </div>
        <div className={s.rejectedBody}>
          {rejectedPosts.totalCount === 0 && <EmptyItem />}

          {rejectedPosts.totalCount !== 0 &&
            rejectedPosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
    </>
  )
}
