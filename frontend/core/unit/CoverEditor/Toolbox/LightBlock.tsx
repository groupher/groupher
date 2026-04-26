import { values } from 'ramda'
import type { FC } from 'react'

import { IMAGE_POS } from '../constant'
import useSalon, { cn } from '../salon/toolbox/light_block'
import type { TImagePos } from '../spec'
import useLogic from '../useLogic'

type TProps = {
  pos: TImagePos
}

const LightBlock: FC<TProps> = ({ pos }) => {
  const s = useSalon()
  const { lightPosOnChange } = useLogic()

  return (
    <div className={s.wrapper}>
      <div className={s.block}>
        {values(IMAGE_POS).map((_pos) => {
          if (_pos === IMAGE_POS.NONE) return null

          return (
            <div
              key={_pos}
              className={cn(s.pice, pos === _pos && s.piceActive)}
              onClick={() => lightPosOnChange(_pos)}
            />
          )
        })}
      </div>
      <div className={s.title}>灯光</div>
    </div>
  )
}

export default LightBlock
