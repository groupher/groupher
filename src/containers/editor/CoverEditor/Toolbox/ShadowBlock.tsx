import { type FC, useState, Fragment } from 'react'
import { values } from 'ramda'

import ShadowSVG from '~/icons/Shadow'
import EmptySVG from '~/icons/Empty'
import Tooltip from '~/widgets/Tooltip'

import type { TSettingLevel } from '../spec'
import { IMAGE_SHADOW, SETTING_LEVEL } from '../constant'

import useLogic from '../useLogic'
import useSalon, { cn } from '../styles/toolbox/shadow_block'

type TProps = {
  shadowLevel: TSettingLevel
}

const ShadowBlock: FC<TProps> = ({ shadowLevel }) => {
  const s = useSalon()
  const { shadowOnChange } = useLogic()
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className={s.wrapper}>
      <Tooltip
        content={
          <Fragment>
            {panelOpen && (
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
                        'debug',
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
            )}
          </Fragment>
        }
        placement="top"
        trigger="mouseenter focus"
        onShow={() => setPanelOpen(true)}
        onHide={() => setPanelOpen(false)}
        hideOnClick={false}
        noPadding
      >
        <div className={cn(s.block, panelOpen && s.blockActive)}>
          <ShadowSVG className={s.icon} />
        </div>
      </Tooltip>

      <div className={s.title}>阴影</div>
    </div>
  )
}

export default ShadowBlock
