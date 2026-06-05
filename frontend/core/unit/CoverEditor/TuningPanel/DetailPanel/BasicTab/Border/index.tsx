import EmptySVG from '~/icons/Empty'
import Radio from '~/widgets/Switcher/Radio'

import { IMAGE_BORDER_RADIUS, SETTING_LEVEL } from '../../../../constant'
import type { TBorderHighlight, TSettingLevel } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import Controller from './Controller'
import useSalon, { cn } from './salon'

type TProps = {
  borderRadiusLevel: TSettingLevel
  borderHighlight: TBorderHighlight
  hasGlassBorder: boolean
}

const RADIUS_LEVELS = Object.values(SETTING_LEVEL).filter(
  (level) => level !== SETTING_LEVEL.L3,
) as TSettingLevel[]

export default function Border({ borderRadiusLevel, borderHighlight, hasGlassBorder }: TProps) {
  const s = useSalon()
  const { borderRadiusOnChange, glassBorderOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <div className={s.items}>
        <GroupItem label='Corner'>
          <div className={s.optionRow}>
            {RADIUS_LEVELS.map((level) =>
              level === SETTING_LEVEL.L1 ? (
                <button
                  key={level}
                  type='button'
                  className={cn(
                    s.radiusEmptyItem,
                    borderRadiusLevel === level && s.optionItemActive,
                  )}
                  onClick={() => borderRadiusOnChange(level)}
                >
                  <EmptySVG className={s.emptyIcon} />
                </button>
              ) : (
                <button
                  key={level}
                  type='button'
                  className={cn(s.radiusBox, borderRadiusLevel === level && s.radiusBoxActive)}
                  style={{
                    borderRadius: IMAGE_BORDER_RADIUS[level],
                  }}
                  aria-label={level}
                  onClick={() => borderRadiusOnChange(level)}
                />
              ),
            )}
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
