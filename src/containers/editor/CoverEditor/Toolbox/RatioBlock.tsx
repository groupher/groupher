import { type FC, useState, Fragment } from 'react'

import RatioSVG from '~/icons/Ratio'
import Tooltip from '~/widgets/Tooltip'

import type { TImageRadio } from '../spec'
import { IMAGE_RATIO } from '../constant'

import useLogic from '../useLogic'
import useSalon, { cn } from '../styles/toolbox/ratio_block'

type TProps = {
  ratio: TImageRadio
}

const RatioBlock: FC<TProps> = ({ ratio }) => {
  const s = useSalon()

  const { ratioOnChange } = useLogic()
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className={s.wrapper}>
      <Tooltip
        content={
          <Fragment>
            {panelOpen && (
              <div className={s.panel}>
                <div
                  className={cn(s.optionItem, ratio === IMAGE_RATIO.SCREEN && s.optionItemActive)}
                  onClick={() => ratioOnChange(IMAGE_RATIO.SCREEN)}
                >
                  16:9
                </div>

                <div
                  className={cn(s.optionItem, ratio === IMAGE_RATIO.TV && s.optionItemActive)}
                  onClick={() => ratioOnChange(IMAGE_RATIO.TV)}
                >
                  4:3
                </div>
                <div
                  className={cn(s.optionItem, ratio === IMAGE_RATIO.SQUARE && s.optionItemActive)}
                  onClick={() => ratioOnChange(IMAGE_RATIO.SQUARE)}
                >
                  1:1
                </div>
              </div>
            )}
          </Fragment>
        }
        placement="top"
        trigger="mouseenter focus"
        onShow={() => setPanelOpen(true)}
        onHide={() => setPanelOpen(false)}
        hideOnClick={false}
        offset={[-1, 5]}
        noPadding
      >
        <div className={cn(s.block, panelOpen && s.blockActive)}>
          <RatioSVG className={s.icon} />
        </div>
      </Tooltip>

      <div className={s.title}>比例</div>
    </div>
  )
}

export default RatioBlock
