import type { TCoverPoint } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import MagnifierControl from './Control'
import useSalon from './salon'

type TProps = {
  center: TCoverPoint
  radius: number
  zoom: number
  enabled: boolean
}

export default function Magnifier({ center, radius, zoom, enabled }: TProps) {
  const s = useSalon()
  const { magnifierRadiationOnChange, magnifierZoomOnChange, magnifierOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Position'>
        <MagnifierControl
          value={{ center, radius, zoom }}
          label='Magnifier position'
          disabled={!enabled}
          onChange={(next) => {
            magnifierRadiationOnChange(next.center, next.radius)
            magnifierZoomOnChange(next.zoom)
          }}
          onToggle={() => magnifierOnChange(!enabled)}
        />
      </GroupItem>
    </section>
  )
}
