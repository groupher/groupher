import { keys } from 'ramda'
import type { FC } from 'react'

import ArchSVG from '~/icons/Arch'
import EmptySVG from '~/icons/Empty'
import Radio from '~/widgets/Switcher/Radio'

import { IMAGE_BORDER_RADIUS, IMAGE_SHADOW, LINEAR_BORDER, SETTING_LEVEL } from '../../constant'
import useSalon, { cn } from '../../salon/toolbox/border_block'
import type { TLinearBorderPos, TSettingLevel } from '../../spec'
import useLogic from '../../useLogic'
import ToolUnit from '../ToolUnit'
import BorderBox from './BorderBox'

type TProps = {
  borderRadiusLevel: TSettingLevel
  linearBorderPos: TLinearBorderPos
  hasGlassBorder: boolean
}

const ArchBlock: FC<TProps> = ({ borderRadiusLevel, linearBorderPos, hasGlassBorder }) => {
  const s = useSalon()

  const { borderRadiusOnChange, linearBorderPosOnChange, glassBorderOnChange } = useLogic()

  return (
    <ToolUnit
      title='边框'
      className='-ml-1'
      icon={<ArchSVG className={s.icon} />}
      panel={
        <div className={s.panel}>
          <div className='row'>
            <div className={s.rowTitle}>圆角</div>
            <div className={s.radiusContentsRow}>
              {keys(IMAGE_BORDER_RADIUS).map((level) => {
                if (level === 'L1') {
                  return (
                    <div
                      key={level}
                      className={cn(
                        s.optionItem,
                        borderRadiusLevel === SETTING_LEVEL[level] && s.optionItemActive,
                      )}
                      onClick={() => borderRadiusOnChange(SETTING_LEVEL[level])}
                    >
                      <EmptySVG className={s.forbidIcon} />
                    </div>
                  )
                }

                if (level === 'L3') return null

                return (
                  <div
                    key={level}
                    className={cn(
                      s.radiusBox,
                      borderRadiusLevel === SETTING_LEVEL[level] && s.radiusBoxActive,
                    )}
                    style={{
                      boxShadow: IMAGE_SHADOW[level],
                      borderRadius: IMAGE_BORDER_RADIUS[level],
                    }}
                    onClick={() => borderRadiusOnChange(SETTING_LEVEL[level])}
                  />
                )
              })}
            </div>
          </div>
          <div className={s.divider} />
          <div className={s.borderRow}>
            <div className={s.rowTitle}>边框</div>
            <div className={s.borderContentsRow}>
              {keys(LINEAR_BORDER).map((pos) => {
                if (pos === LINEAR_BORDER.NONE.toUpperCase()) {
                  return (
                    <div
                      key={pos}
                      className={cn(
                        s.optionItem,
                        linearBorderPos === LINEAR_BORDER.NONE && s.optionItemActive,
                      )}
                      onClick={() => linearBorderPosOnChange(LINEAR_BORDER.NONE)}
                    >
                      <EmptySVG className={s.forbidIcon} />
                    </div>
                  )
                }
                return <BorderBox key={pos} pos={pos} linearBorderPos={linearBorderPos} />
              })}
            </div>
          </div>
          <div className={s.divider} />
          <div className={s.borderRow}>
            <div className={s.rowTitle}>外框</div>
            <Radio
              size='small'
              top={-0.5}
              left={-0.5}
              items={[
                {
                  value: '有',
                  key: true,
                },
                {
                  value: '无',
                  key: false,
                  dimOnActive: true,
                },
              ]}
              activeKey={hasGlassBorder}
              onChange={(item) => glassBorderOnChange(item.key as boolean)}
            />
          </div>
        </div>
      }
    />
  )
}

export default ArchBlock
