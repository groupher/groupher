import RangeInput from '~/widgets/RangeInput'

import { IMAGE_BORDER_RADIUS_RANGE } from '../../../../constant'
import type { TBorderHighlight } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import Controller from './Controller'
import GlassFrameControl from './GlassFrameControl'
import useSalon from './salon'

type TProps = {
  borderRadius: number
  borderHighlight: TBorderHighlight
  hasGlassBorder: boolean
}

export default function Border({ borderRadius, borderHighlight, hasGlassBorder }: TProps) {
  const s = useSalon()
  const { borderRadiusOnChange, glassBorderOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <div className={s.items}>
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

        <GroupItem label='Border'>
          <Controller borderHighlight={borderHighlight} />
        </GroupItem>

        <GroupItem label='Frame'>
          <GlassFrameControl
            enabled={hasGlassBorder}
            onToggle={() => glassBorderOnChange(!hasGlassBorder)}
          />
        </GroupItem>
      </div>
    </section>
  )
}
