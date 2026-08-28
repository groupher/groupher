import HashTagSVG from '~/icons/HashTagBold'

import useSalon, { cn } from '../../salon/dashboard_intros/tags_tab/sidebar'

export default function Sidebar() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.bar, 'top-1.5 left-0')} />
      <div className={cn(s.bar, 'top-5 left-0 w-12 opacity-10')} />
      <div className={cn(s.bar, 'top-56 left-0 w-12 opacity-10')} />

      <div className={s.tag}>
        <HashTagSVG className={s.icon} />
        <div className={s.title}>iOS</div>
      </div>

      <div className={s.tag}>
        <HashTagSVG className={s.icon} />
        <div className={s.title}>Web</div>
      </div>

      <div className={cn(s.tag, 'opacity-100')}>
        <HashTagSVG className={cn(s.icon, s.fillGreen)} />
        <div className={cn(s.title, 'bold-sm')}>Android</div>
      </div>

      <div className={s.tag}>
        <HashTagSVG className={s.icon} />
        <div className={s.title}>编辑器</div>
      </div>

      <div className={s.tag}>
        <HashTagSVG className={s.icon} />
        <div className={s.title}>安全性</div>
      </div>

      <div className={s.tag}>
        <HashTagSVG className={s.icon} />
        <div className={s.title}>安装部署</div>
      </div>
    </div>
  )
}
