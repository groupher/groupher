import RadiationControl from '~/widgets/RadiationControl'

import type { TCoverPoint } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import useSalon from './salon'

type TProps = {
  center: TCoverPoint
  radius: number
  enabled: boolean
}

export default function Light({ center, radius, enabled }: TProps) {
  const s = useSalon()
  const { lightRadiationOnChange, lightOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Position'>
        <RadiationControl
          value={{ center, radius }}
          label='Lighting position'
          disabled={!enabled}
          onChange={(next) => lightRadiationOnChange(next.center, next.radius)}
          onToggle={() => lightOnChange(!enabled)}
        />
      </GroupItem>
    </section>
  )
}
