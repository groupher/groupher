import ArrowLinker from '~/widgets/ArrowLinker'
import Button from '~/widgets/Buttons/Button'

import type { TIntroTab } from '../spec'
import INTROS from './constant'
import FeatItem from './FeatItem'

import useSalon, { cn } from '../../salon/dashboard_intros/side_intros'

type TProps = {
  tab: TIntroTab
}

export default ({ tab }: TProps) => {
  const intro = INTROS[tab]
  const { color, icon } = intro

  const s = useSalon({ color })

  const Icon = icon

  return (
    <div key={tab} className={s.wrapper}>
      <div className={s.head}>
        <div className={s.iconBox}>
          <Icon className={cn(s.icon, intro.iconClass || '')} />
        </div>
        <div className={s.title}>{intro.title}</div>
        <div className={s.desc}>{intro.desc}</div>
        <div className={s.barDivider} />
      </div>

      {intro.items.map((item) => (
        <FeatItem key={item} text={item} color={color} />
      ))}

      <div className={s.footer}>
        <Button color={color} ghost className="w-20">
          查看示例
        </Button>

        <ArrowLinker href="/" color={color}>
          了解更多
        </ArrowLinker>
      </div>
    </div>
  )
}
