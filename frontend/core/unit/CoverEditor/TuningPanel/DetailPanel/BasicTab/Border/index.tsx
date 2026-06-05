import RangeInput from '~/widgets/RangeInput'
import Radio from '~/widgets/Switcher/Radio'

import { IMAGE_BORDER_RADIUS_RANGE } from '../../../../constant'
import type { TBorderHighlight } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import Controller from './Controller'
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
          <Radio
            size='small'
            top={-0.5}
            left={-0.5}
            items={[
              {
                value: 'On',
                key: true,
              },
              {
                value: 'Off',
                key: false,
                dimOnActive: true,
              },
            ]}
            activeKey={hasGlassBorder}
            onChange={(item) => glassBorderOnChange(item.key as boolean)}
          />
        </GroupItem>
      </div>
    </section>
  )
}
