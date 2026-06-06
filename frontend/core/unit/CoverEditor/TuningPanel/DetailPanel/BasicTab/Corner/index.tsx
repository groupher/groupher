import RangeInput from '~/widgets/RangeInput'

import { IMAGE_BORDER_RADIUS_RANGE } from '../../../../constant'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import useSalon from './salon'

type TProps = {
  borderRadius: number
}

export default function Corner({ borderRadius }: TProps) {
  const s = useSalon()
  const { borderRadiusOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Corner'>
        <div className={s.rangeRow}>
          <RangeInput
            value={borderRadius}
            min={IMAGE_BORDER_RADIUS_RANGE.MIN}
            max={IMAGE_BORDER_RADIUS_RANGE.MAX}
            step={1}
            width='w-36'
            valueLabel='Corner'
            aria-label='Corner'
            hideLabel
            onChange={borderRadiusOnChange}
          />
        </div>
      </GroupItem>
    </section>
  )
}
