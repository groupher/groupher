import { type FC, useState, Fragment } from 'react'

import Tooltip from '~/widgets/Tooltip'

import ImageSizeSVG from '~/icons/ImageSize'

import type { TImageSize } from '../spec'
import { IMAGE_SIZE } from '../constant'

import useLogic from '../useLogic'
import useSalon, { cn } from '../salon/toolbox/size_block'

type TProps = {
  size: TImageSize
}

const SizeBlock: FC<TProps> = ({ size }) => {
  const s = useSalon()
  const { sizeOnChange } = useLogic()
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className={s.wrapper}>
      <Tooltip
        content={
          <Fragment>
            {panelOpen && (
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
                  className={cn(
                    s.optionItem,
                    'text-xs',
                    size === IMAGE_SIZE.SMALL && s.optionItemActive,
                  )}
                  onClick={() => sizeOnChange(IMAGE_SIZE.SMALL)}
                >
                  小
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
          <ImageSizeSVG className={s.icon} />
        </div>
      </Tooltip>
      <div className={s.title}>大小</div>
    </div>
  )
}

export default SizeBlock
