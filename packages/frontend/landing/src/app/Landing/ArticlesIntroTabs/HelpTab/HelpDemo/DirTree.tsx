import GithubSVG from '~/icons/Github8'
import BookSVG from '~/icons/Book'

import useSalon, { cn } from '../../../salon/articles_intro_tabs/help_tab/help_demo/dir_tree'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.pinnedItem}>
        <BookSVG className={s.icon} />
        <div className={s.file}>全部文档</div>
      </div>
      <div className={s.pinnedItem}>
        <GithubSVG className={s.icon} />
        <div className={s.file}>Github</div>
      </div>

      <div className="mt-3" />

      <div className={s.dir}>社区</div>
      <div className={s.file}>基本信息</div>
      <div className={s.file}>整体布局</div>
      <div className={s.file}>管理员</div>

      <div className="mt-3.5" />

      <div className={s.dir}>讨论区</div>
      <div className={s.file}>帖子布局</div>
      <div className={s.file}>标签设置</div>

      <div className="mt-3.5" />
      <div className={cn(s.dir, 'opacity-75')}>看板</div>
      <div className={cn(s.file, 'opacity-80')}>看板颜色</div>
      <div className={cn(s.file, 'opacity-65')}>状态转换</div>

      <div className="mt-3.5" />

      <div className={cn(s.dir, 'opacity-50')}>更新日志</div>
      <div className={cn(s.file, 'opacity-50')}>封面编辑器</div>
      <div className={cn(s.file, 'opacity-30')}>基本信息设置</div>
    </div>
  )
}
