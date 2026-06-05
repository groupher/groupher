import FocalPointControl from '~/widgets/FocalPointControl'
import Radio from '~/widgets/Switcher/Radio'

import type { TCoverPoint } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import useSalon from './salon'

type TProps = {
  center: TCoverPoint
  enabled: boolean
}

export default function Light({ center, enabled }: TProps) {
  const s = useSalon()
  const { lightCenterOnChange, lightOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Enabled'>
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
          activeKey={enabled}
          onChange={(item) => lightOnChange(item.key as boolean)}
        />
      </GroupItem>

      <GroupItem label='Position'>
        <FocalPointControl
          value={center}
          label='Lighting position'
          disabled={!enabled}
          onChange={lightCenterOnChange}
        />
      </GroupItem>
    </section>
  )
}
