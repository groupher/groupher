import EmptySVG from '~/icons/Empty'

import { IMAGE_SHADOW, SETTING_LEVEL } from '../../../../constant'
import type { TSettingLevel } from '../../../../spec'
import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import useSalon, { cn } from './salon'

type TProps = {
  shadowLevel: TSettingLevel
}

const OPTIONS = Object.values(SETTING_LEVEL) as TSettingLevel[]

export default function Shadow({ shadowLevel }: TProps) {
  const s = useSalon()
  const { shadowOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Shadow'>
        <div className={s.optionRow}>
          {OPTIONS.map((level) =>
            level === SETTING_LEVEL.L1 ? (
              <button
                key={level}
                type='button'
                className={cn(s.emptyItem, shadowLevel === level && s.optionItemActive)}
                onClick={() => shadowOnChange(level)}
              >
                <EmptySVG className={s.emptyIcon} />
              </button>
            ) : (
              <button
                key={level}
                type='button'
                className={cn(s.shadowBox, shadowLevel === level && s.optionItemActive)}
                style={{ boxShadow: IMAGE_SHADOW[level] }}
                aria-label={level}
                onClick={() => shadowOnChange(level)}
              />
            ),
          )}
        </div>
      </GroupItem>
    </section>
  )
}
