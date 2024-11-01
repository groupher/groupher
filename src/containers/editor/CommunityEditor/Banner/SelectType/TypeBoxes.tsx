import useTheme from '~/hooks/useTheme'

import CheckSVG from '~/icons/CheckCircle'

import { COMMUNITY_CATS } from '../../constant'
import useLogic from '../../useLogic'
import useSalon, { cn, Icon } from '../../styles/banner/select_type/type_boxes'

export default () => {
  const s = useSalon()
  const { theme } = useTheme()
  const { communityType, communityTypeOnChange } = useLogic()

  return (
    <div className={s.wrapper} key={theme}>
      {COMMUNITY_CATS.map((item) => {
        const active = item.type === communityType
        const IconComp = Icon[item.icon]

        return (
          <div
            key={item.type}
            className={cn(s.block, active && s.blockActive)}
            onClick={() => communityTypeOnChange(item.type)}
          >
            <div className={s.header}>
              <IconComp className={cn(s.icon, active && s.iconActive)} />
              {active && <CheckSVG className={s.checkIcon} />}
            </div>
            <h3 className={s.title}>{item.title}</h3>
            <div className="grow" />
          </div>
        )
      })}
    </div>
  )
}
