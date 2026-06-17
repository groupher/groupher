import type { FC, SVGProps } from 'react'

import ArrowsOutCardinalSVG from '~/icons/ArrowsOutCardinal'
import ResizeSVG from '~/icons/Resize'
import Tooltip from '~/widgets/Tooltip'

import { IMAGE_EDIT_MODE, IMAGE_EDIT_MODE_LABEL } from '../constant'
import type { TImageEditMode } from '../spec'
import useSalon, { cn } from './salon/image_mode_toggle'

type TProps = {
  active: boolean
  mode: TImageEditMode
  onChange: (mode: TImageEditMode) => void
}

const ITEMS: {
  Icon: FC<SVGProps<SVGSVGElement>>
  mode: TImageEditMode
}[] = [
  { Icon: ArrowsOutCardinalSVG, mode: IMAGE_EDIT_MODE.MOVE },
  { Icon: ResizeSVG, mode: IMAGE_EDIT_MODE.REPOSITION },
]

const ImageModeToggle: FC<TProps> = ({ active, mode, onChange }) => {
  const s = useSalon()

  return (
    <div className={cn(s.wrapper, s.shell, active && s.wrapperActive)}>
      {ITEMS.map((item) => {
        const selected = item.mode === mode
        const label = IMAGE_EDIT_MODE_LABEL[item.mode]
        const Icon = item.Icon

        return (
          <Tooltip
            key={item.mode}
            content={<span className={s.tooltipText}>{label}</span>}
            placement='top'
            delay={300}
            portalToBody
          >
            <button
              type='button'
              className={cn(
                s.button,
                selected ? s.buttonActive : s.buttonIdle,
                item.mode === IMAGE_EDIT_MODE.REPOSITION && !selected && s.buttonRepositionIdle,
              )}
              aria-label={label}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onChange(item.mode)}
            >
              <Icon className={s.icon} />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

export default ImageModeToggle
