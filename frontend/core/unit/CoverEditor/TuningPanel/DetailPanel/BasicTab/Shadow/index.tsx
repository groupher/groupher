import SettingSVG from '~/icons/Setting'
import Tooltip from '~/widgets/Tooltip'

import { IMAGE_SIZE_RANGE } from '../../../../constant'
import { getImageShadow, normalizeCoverShadow } from '../../../../helper'
import { getImagePlacement, getResponsiveImageSize } from '../../../../salon/metric'
import type { TCoverPoint, TCoverShadow, TImageSize } from '../../../../spec'
import { POSITION_PREVIEW_FRAME_SCALE } from '../Position/constant'
import Panel from './Panel'
import useSalon from './salon'

type TProps = {
  imageDominantColor: string | null
  position: TCoverPoint
  shadow: TCoverShadow
  size: TImageSize
  rotate: number
}

type TSettingsProps = {
  shadow: TCoverShadow
}

export function ShadowSettings({ shadow }: TSettingsProps) {
  const s = useSalon()
  const normalizedShadow = normalizeCoverShadow(shadow)

  return (
    <Tooltip
      placement='right'
      trigger='click'
      hideOnClick={false}
      maxWidth='none'
      offset={[8, 0]}
      portalToBody
      content={<Panel shadow={normalizedShadow} />}
    >
      <button type='button' className={s.settingButton} aria-label='Shadow settings'>
        <SettingSVG className={s.settingIcon} />
      </button>
    </Tooltip>
  )
}

export default function Shadow({ imageDominantColor, position, shadow, size, rotate }: TProps) {
  const s = useSalon()
  const normalizedShadow = normalizeCoverShadow(shadow)
  const frameSize = getResponsiveImageSize(size)
  const previewFrameScale = size >= IMAGE_SIZE_RANGE.MAX ? 1 : POSITION_PREVIEW_FRAME_SCALE
  const previewFrameSize = {
    width: `${Number.parseFloat(frameSize.width) * previewFrameScale}%`,
    height: `${Number.parseFloat(frameSize.height) * previewFrameScale}%`,
  }
  const placement = getImagePlacement(position, size, rotate)

  return (
    <div className={s.wrapper}>
      <div className={s.previewCard}>
        <span
          className={s.frameBlock}
          style={{
            width: previewFrameSize.width,
            height: previewFrameSize.height,
            left: placement.left,
            top: placement.top,
            transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
          }}
        >
          <span
            className={s.frameFill}
            style={{
              backgroundColor: imageDominantColor ?? undefined,
              boxShadow: getImageShadow(normalizedShadow),
            }}
          />
        </span>
      </div>
    </div>
  )
}
