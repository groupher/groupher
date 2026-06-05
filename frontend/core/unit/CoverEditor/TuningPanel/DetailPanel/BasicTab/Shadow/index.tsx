import RangeInput from '~/widgets/RangeInput'

import { IMAGE_SHADOW_RANGE } from '../../../../constant'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import useSalon from './salon'

type TProps = {
  shadow: number
}

export default function Shadow({ shadow }: TProps) {
  const s = useSalon()
  const { shadowOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Shadow'>
        <div className={s.rangeRow}>
          <RangeInput
            value={shadow}
            min={IMAGE_SHADOW_RANGE.MIN}
            max={IMAGE_SHADOW_RANGE.MAX}
            step={1}
            width='w-36'
            valueLabel='Shadow'
            aria-label='Shadow'
            hideLabel
            onChange={shadowOnChange}
          />
        </div>
      </GroupItem>
    </section>
  )
}
