import type { TCoverPoint, TImageSize } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import Controller from './Controller'
import useSalon from './salon'

type TProps = {
  position: TCoverPoint
  size: TImageSize
  rotate: number
}

export default function Position({ position, size, rotate }: TProps) {
  const { positionOnChange } = useLogic()
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Position'>
        <Controller position={position} size={size} rotate={rotate} onChange={positionOnChange} />
      </GroupItem>
    </section>
  )
}
