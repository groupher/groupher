/* *
 * KanbanThread
 *
 */

import useKanbanPosts from '~/hooks/useKanbanPosts'

import GtdWipSVG from '~/icons/GtdWip'
import GtdDoneSVG from '~/icons/GtdDone'
import GtdTodoSVG from '~/icons/GtdTodo'

import KanbanItem from '~/widgets/KanbanItem'
import EmptyItem from '~/widgets/KanbanItem/EmptyItem'

import useSalon from '../salon/classic_layout/columns'

export default () => {
  const s = useSalon()

  const { todo: todoPosts, wip: wipPosts, done: donePosts } = useKanbanPosts()

  return (
    <>
      <div className={s.column}>
        <div className={s.header}>
          <GtdTodoSVG className={s.todoIcon} />
          <h4 className={s.label}>待办</h4>
          <div className={s.subTitle}>{todoPosts.totalCount}</div>
          <div className="grow" />
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
          <div className="grow" />
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
          <div className="grow" />
        </div>
        <div className={s.doneBody}>
          {donePosts.totalCount === 0 && <EmptyItem />}

          {donePosts.totalCount !== 0 &&
            donePosts.entries.map((item) => <KanbanItem key={item.innerId} article={item} />)}
        </div>
      </div>
    </>
  )
}
