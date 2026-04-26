import { values } from 'ramda'
import type { FC } from 'react'

import { IMAGE_POS } from '../constant'
import useSalon, { cn } from '../salon/toolbox/position_block'
import type { TImagePos } from '../spec'
import useLogic from '../useLogic'

type TProps = {
  pos: TImagePos
}

const PositionBlock: FC<TProps> = ({ pos }) => {
  const s = useSalon()
  const { posOnChange } = useLogic()

  return (
    <div className={s.wrapper}>
      <div className={s.block}>
        {values(IMAGE_POS).map((_pos) => {
          if (_pos === IMAGE_POS.NONE) return null

          return (
            <div
              key={_pos}
              className={cn(s.pice, pos === _pos && s.piceActive)}
              onClick={() => posOnChange(_pos)}
            />
          )
        })}
      </div>
      <div className={s.title}>位置</div>
    </div>
  )
}

export default PositionBlock
