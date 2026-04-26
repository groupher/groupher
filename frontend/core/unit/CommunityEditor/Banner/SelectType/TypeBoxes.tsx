import CheckSVG from '~/icons/CheckCircle'

import { COMMUNITY_CATS } from '../../constant'
import useSalon, { cn, Icon } from '../../salon/banner/select_type/type_boxes'
import useLogic from '../../useLogic'
import IntroImages from './IntroImages'

export default function TypeBoxes() {
  const s = useSalon()
  const { communityType, communityTypeOnChange } = useLogic()

  return (
    <div className={s.wrapper}>
      {COMMUNITY_CATS.map((item) => {
        const active = item.type === communityType
        const IconComp = Icon[item.type]

        return (
          <div
            key={item.type}
            className={cn(s.block, active && s.blockActive)}
            onClick={() => communityTypeOnChange(item.type)}
          >
            <IntroImages type={item.type} current={communityType} />

            <div className={s.header}>
              <IconComp className={cn(s.icon, active && s.iconActive)} />
              {active ? <CheckSVG className={s.checkIcon} /> : <div className={s.emptyCheck} />}
            </div>
            <h3 className={cn(s.title, active && s.titleActive)}>{item.title}</h3>
            <div className='grow' />
          </div>
        )
      })}
    </div>
  )
}
