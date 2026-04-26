import type { FC } from 'react'

import RatioSVG from '~/icons/Ratio'

import { IMAGE_RATIO } from '../constant'
import useSalon, { cn } from '../salon/toolbox/ratio_block'
import type { TImageRadio } from '../spec'
import useLogic from '../useLogic'
import ToolUnit from './ToolUnit'

type TProps = {
  ratio: TImageRadio
}

const RatioBlock: FC<TProps> = ({ ratio }) => {
  const s = useSalon()

  const { ratioOnChange } = useLogic()

  return (
    <ToolUnit
      title='比例'
      icon={<RatioSVG className={s.icon} />}
      panel={
        <div className='row-center gap-x-2 px-4 py-3'>
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
      }
    />
  )
}

export default RatioBlock
