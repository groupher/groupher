import type { TCoverPoint, TImageRadio, TImageSize } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import FramePositionControl from './FramePositionControl'

type TProps = {
  position: TCoverPoint
  size: TImageSize
  ratio: TImageRadio
  rotate: number
}

export default function Position({ position, size, ratio, rotate }: TProps) {
  const { positionOnChange } = useLogic()

  return (
    <section>
      <GroupItem label='Position'>
        <FramePositionControl
          position={position}
          size={size}
          ratio={ratio}
          rotate={rotate}
          onChange={positionOnChange}
        />
      </GroupItem>
    </section>
  )
}
