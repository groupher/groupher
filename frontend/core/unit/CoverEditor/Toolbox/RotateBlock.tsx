import type { FC } from 'react'

import RotateSVG from '~/icons/Rotate'
import RangeSlider from '~/widgets/RangeSlider'

import useSalon from '../salon/toolbox/rotate_block'
import useLogic from '../useLogic'
import ToolUnit from './ToolUnit'

type TProps = {
  rotate: number
}

const RotateBlock: FC<TProps> = ({ rotate }) => {
  const s = useSalon()

  const { rotateOnChange } = useLogic()

  return (
    <ToolUnit
      title='旋转'
      icon={<RotateSVG className={s.icon} />}
      panel={
        <div className={s.panel}>
          {rotate !== 0 && (
            <div className={s.reset} onClick={() => rotateOnChange(0)}>
              回正
            </div>
          )}
          <RangeSlider value={rotate} onChange={(v) => rotateOnChange(v)} />
        </div>
      }
    />
  )
}

export default RotateBlock
