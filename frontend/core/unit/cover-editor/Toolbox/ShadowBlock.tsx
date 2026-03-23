import { values } from 'ramda'
import type { FC } from 'react'
import EmptySVG from '~/icons/Empty'
import ShadowSVG from '~/icons/Shadow'
import { IMAGE_SHADOW, SETTING_LEVEL } from '../constant'
import useSalon, { cn } from '../salon/toolbox/shadow_block'
import type { TSettingLevel } from '../spec'

import useLogic from '../useLogic'
import ToolUnit from './ToolUnit'

type TProps = {
  shadowLevel: TSettingLevel
}

const ShadowBlock: FC<TProps> = ({ shadowLevel }) => {
  const s = useSalon()
  const { shadowOnChange } = useLogic()

  return (
    <ToolUnit
      title='阴影'
      icon={<ShadowSVG className={s.icon} />}
      panel={
        <div className={s.panel}>
          {values(SETTING_LEVEL).map((level) => {
            if (level === 'L1') {
              return (
                <div
                  key={level}
                  className={cn(
                    s.optionItem,
                    shadowLevel === SETTING_LEVEL[level] && s.optionItemActive,
                  )}
                  onClick={() => shadowOnChange(SETTING_LEVEL[level])}
                >
                  <EmptySVG className={s.forbidIcon} />
                </div>
              )
            }

            return (
              <div
                key={level}
                className={cn(
                  s.shadowBox,
                  shadowLevel === SETTING_LEVEL[level] && s.optionItemActive,
                )}
                style={{
                  boxShadow: IMAGE_SHADOW[level],
                }}
                onClick={() => shadowOnChange(SETTING_LEVEL[level])}
              />
            )
          })}
        </div>
      }
    />
  )
}

export default ShadowBlock
