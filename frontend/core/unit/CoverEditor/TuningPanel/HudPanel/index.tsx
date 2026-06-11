import ArchSVG from '~/icons/Arch'
import ArrowSVG from '~/icons/ArrowSimple'
import ImageSizeSVG from '~/icons/ImageSize'
import RotateSVG from '~/icons/Rotate'
import ShadowSVG from '~/icons/Shadow'
import { composeBgCss } from '~/lib/bg'

import { IMAGE_SIZE_RANGE } from '../../constant'
import { isCoverShadowActive } from '../../helper'
import { getImagePlacement, getResponsiveImageSize } from '../../salon/metric'
import type { TTuningSetting } from '../../spec'
import { getBorderValue, isCenterPoint } from './helper'
import HudItem from './HudItem'
import useSalon, { cn } from './salon'

type TProps = {
  setting: TTuningSetting
  onExpand: () => void
}

export default function HudPanel({ setting, onExpand }: TProps) {
  const s = useSalon()
  const { activeImage, activeBackground } = setting
  const borderRadius = activeImage?.borderRadius ?? 0
  const borderHighlight = activeImage?.borderHighlight
  const glassBorder = activeImage?.glassBorder ?? { enabled: false }
  const magnifier = activeImage?.magnifier
  const magnifierEnabled = magnifier?.enabled ?? false
  const magnifierCenter = magnifier?.center ?? { x: 0.5, y: 0.5 }
  const magnifierZoom = magnifier?.zoom ?? 1
  const position = activeImage?.position ?? { x: 0.5, y: 0.5 }
  const rotate = activeImage?.rotate ?? 0
  const shadow = activeImage?.shadow
  const size = activeImage?.size ?? IMAGE_SIZE_RANGE.MAX

  const borderValue = borderHighlight
    ? getBorderValue({ borderRadius, borderHighlight, glassBorder })
    : ''
  const frameSize = getResponsiveImageSize(size)
  const framePlacement = getImagePlacement(position, size, rotate)
  const backgroundPreview = composeBgCss(activeBackground)

  return (
    <div className={s.wrapper}>
      <div className={s.hudItems}>
        <HudItem
          label='位置'
          active={!isCenterPoint(position)}
          icon={
            <span className={s.coverIcon}>
              <span
                className={s.coverIconFrame}
                style={{
                  width: frameSize.width,
                  height: frameSize.height,
                  left: framePlacement.left,
                  top: framePlacement.top,
                  transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
                }}
              />
            </span>
          }
        />
        <HudItem
          label='大小'
          active={size !== IMAGE_SIZE_RANGE.MAX}
          icon={<ImageSizeSVG className={s.icon} />}
          value={`${Math.round(size)}%`}
        />
        <HudItem
          label='阴影'
          active={shadow ? isCoverShadowActive(shadow) : false}
          icon={<ShadowSVG className={s.icon} />}
        />
        <HudItem
          label='边框'
          active={borderRadius > 0 || Boolean(borderHighlight?.enabled) || glassBorder.enabled}
          icon={<ArchSVG className={s.icon} />}
          value={borderValue}
        />
        <HudItem
          label='旋转'
          active={rotate !== 0}
          icon={<RotateSVG className={s.icon} />}
          value={`${rotate}°`}
        />
        <HudItem
          label='放大镜'
          active={magnifierEnabled}
          icon={
            <span className={s.coverIcon}>
              <span
                className={cn(s.magnifierDot, magnifierEnabled && s.gridDotActive)}
                style={{
                  left: `${magnifierCenter.x * 100}%`,
                  top: `${magnifierCenter.y * 100}%`,
                }}
              />
            </span>
          }
          value={magnifierEnabled ? `${magnifierZoom}x` : undefined}
        />
        <HudItem
          label='背景'
          active={activeBackground.source !== ''}
          icon={
            <span className={s.bgSwatch} style={{ background: backgroundPreview.background }} />
          }
          value={activeBackground.source || '0'}
        />
      </div>

      <button
        type='button'
        className={s.expandBtn}
        aria-expanded={false}
        aria-label='展开封面设置'
        onClick={onExpand}
      >
        <ArrowSVG className={s.expandIcon} />
      </button>
    </div>
  )
}
