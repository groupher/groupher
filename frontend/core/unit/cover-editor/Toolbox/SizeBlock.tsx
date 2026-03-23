import type { FC } from 'react'

import ImageSizeSVG from '~/icons/ImageSize'
import { IMAGE_SIZE } from '../constant'
import useSalon, { cn } from '../salon/toolbox/size_block'
import type { TImageSize } from '../spec'

import useLogic from '../useLogic'
import ToolUnit from './ToolUnit'

type TProps = {
  size: TImageSize
}

const SizeBlock: FC<TProps> = ({ size }) => {
  const s = useSalon()
  const { sizeOnChange } = useLogic()

  return (
    <ToolUnit
      title='大小'
      icon={<ImageSizeSVG className={s.icon} />}
      className='-ml-1'
      panel={
        <div className={s.panel}>
          <div
            className={cn(
              s.optionItem,
              'text-base',
              size === IMAGE_SIZE.LARGE && s.optionItemActive,
            )}
            onClick={() => sizeOnChange(IMAGE_SIZE.LARGE)}
          >
            大
          </div>
          <div
            className={cn(s.optionItem, size === IMAGE_SIZE.MEDIUM && s.optionItemActive)}
            onClick={() => sizeOnChange(IMAGE_SIZE.MEDIUM)}
          >
            中
          </div>
          <div
            className={cn(s.optionItem, 'text-xs', size === IMAGE_SIZE.SMALL && s.optionItemActive)}
            onClick={() => sizeOnChange(IMAGE_SIZE.SMALL)}
          >
            小
          </div>
        </div>
      }
    />
  )
}

export default SizeBlock
