import CheckSVG from '~/icons/CheckCircle'

import useSalon, { cn } from '../../salon/domain/custom/step_bar'

export default function Steps() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.block}>
        <div className={s.hint}>
          第 1 步 <CheckSVG className={s.checkIcon} />
        </div>
        <div className={s.title}>添加自定义域名</div>
      </div>
      <div className={s.block}>
        <div className={s.hint}>第 2 步</div>
        <div className={cn(s.title, s.inActive)}>配置 DNS 记录</div>
      </div>
      <div className={s.block}>
        <div className={s.hint}>第 3 步</div>
        <div className={cn(s.title, s.inActive)}>域名验证/绑定</div>
      </div>
    </div>
  )
}
