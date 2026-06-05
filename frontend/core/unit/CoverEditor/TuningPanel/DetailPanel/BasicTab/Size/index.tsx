import RangeInput from '~/widgets/RangeInput'

import { IMAGE_SIZE_RANGE } from '../../../../constant'
import type { TImageSize } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import useSalon from './salon'

type TProps = {
  size: TImageSize
}

export default function Size({ size }: TProps) {
  const s = useSalon()
  const { sizeOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Size'>
        <div className={s.rangeRow}>
          <RangeInput
            value={size}
            min={IMAGE_SIZE_RANGE.MIN}
            max={IMAGE_SIZE_RANGE.MAX}
            step={1}
            width='w-36'
            valueLabel='Size'
            aria-label='Size'
            hideLabel
            onChange={sizeOnChange}
          />
        </div>
      </GroupItem>
    </section>
  )
}
