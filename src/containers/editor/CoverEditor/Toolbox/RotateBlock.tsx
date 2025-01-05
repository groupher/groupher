import { type FC, useState, Fragment } from 'react'

import Tooltip from '~/widgets/Tooltip'

import RotateSVG from '~/icons/Rotate'
import RangeSlider from '~/widgets/RangeSlider'

import useLogic from '../useLogic'
import useSalon, { cn } from '../salon/toolbox/rotate_block'

type TProps = {
  rotate: number
}

const RotateBlock: FC<TProps> = ({ rotate }) => {
  const s = useSalon()

  const { rotateOnChange } = useLogic()
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className={s.wrapper}>
      <Tooltip
        content={
          <Fragment>
            {panelOpen && (
              <div className={s.panel}>
                {rotate !== 0 && (
                  <div className={s.reset} onClick={() => rotateOnChange(0)}>
                    回正
                  </div>
                )}
                <RangeSlider value={rotate} onChange={(v) => rotateOnChange(v)} />
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
          <RotateSVG className={s.icon} />
        </div>
      </Tooltip>

      <div className={s.title}>旋转</div>
    </div>
  )
}

export default RotateBlock
