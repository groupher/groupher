import PinSVG from '~/icons/Pin'
import EditSVG from '~/icons/EditPen'
import SlugSVG from '~/icons/Slug'
import MergeSVG from '~/icons/Merge'
import ArchivedSVG from '~/icons/Archived'
import DeleteSVG from '~/icons/Trash'
import LockSVG from '~/icons/LockLight'
import ArrowSVG from '~/icons/ArrowSimple'
import WipSVG from '~/icons/GtdWip'

import LightSVG from '~/icons/ColorLight'

import useSalon, { cn } from '../../salon/dashboard_intros/cms_tab/menu_card'

import HashTagBoldSVG from '~/icons/HashTag'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.menuItem}>
        <EditSVG className={s.icon} />
        <div className={s.menuTitle}>修改标题</div>
        <div className="grow" />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </div>

      <div className={s.menuItem}>
        <SlugSVG className={s.icon} />
        <div className={s.menuTitle}>设置 Slug</div>
        <div className="grow" />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </div>
      <div className={s.divider} />
      <div className={s.menuItem}>
        <LightSVG className={s.icon} />
        <div className={s.menuTitle}>功能请求</div>
        <div className="grow" />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </div>

      <div className={s.menuItem}>
        <WipSVG className={s.icon} />
        <div className={s.menuTitle}>进行中</div>
        <div className="grow" />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </div>

      <div className={s.menuItem}>
        <HashTagBoldSVG className={s.tagIcon} />
        <div className={s.menuTitle}>标签</div>
        <div className="grow" />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </div>

      <div className={s.divider} />

      <div className={s.menuItem}>
        <PinSVG className={s.icon} />
        <div className={s.menuTitle}>置顶</div>
      </div>

      <div className={s.menuItem}>
        <LockSVG className={s.icon} />
        <div className={s.menuTitle}>关闭评论</div>
      </div>
      <div className={s.menuItem}>
        <MergeSVG className={s.icon} />
        <div className={s.menuTitle}>合并</div>
        <div className="grow" />
        <ArrowSVG className={s.icon} />
      </div>
      <div className={s.menuItem}>
        <ArchivedSVG className={s.icon} />
        <div className={s.menuTitle}>归档</div>
      </div>
      <div className={s.menuItem}>
        <DeleteSVG className={s.icon} />
        删除
      </div>
    </div>
  )
}
