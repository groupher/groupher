import ArchSVG from '~/icons/Arch'
import ArrowSVG from '~/icons/ArrowSimple'
import ImageSizeSVG from '~/icons/ImageSize'
import RatioSVG from '~/icons/Ratio'
import RotateSVG from '~/icons/Rotate'
import ShadowSVG from '~/icons/Shadow'
import { parseWallpaper } from '~/wallpaper'

import { IMAGE_RATIO, IMAGE_SIZE_RANGE } from '../../constant'
import { getImagePlacement, getResponsiveImageSize } from '../../salon/metric'
import type { TTuningSetting } from '../../spec'
import { RATIO_VALUE } from './constant'
import { getBorderValue, isCenterPoint } from './helper'
import HudItem from './HudItem'
import useSalon, { cn } from './salon'

type TProps = {
  setting: TTuningSetting
  onExpand: () => void
}

export default function HudPanel({ setting, onExpand }: TProps) {
  const s = useSalon()
  const {
    borderRadius,
    borderHighlight,
    hasGlassBorder,
    hasLight,
    lightCenter,
    position,
    ratio,
    rotate,
    shadow,
    size,
    wallpaper,
    wallpapers,
  } = setting

  const borderValue = getBorderValue({ borderRadius, borderHighlight, hasGlassBorder })
  const frameSize = getResponsiveImageSize(size, ratio)
  const framePlacement = getImagePlacement(position, size, ratio, rotate)

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
        <HudItem label='阴影' active={shadow > 0} icon={<ShadowSVG className={s.icon} />} />
        <HudItem
          label='边框'
          active={borderRadius > 0 || borderHighlight.enabled || hasGlassBorder}
          icon={<ArchSVG className={s.icon} />}
          value={borderValue}
        />
        <HudItem
          label='比例'
          active={ratio !== IMAGE_RATIO.SCREEN}
          icon={<RatioSVG className={s.icon} />}
          value={RATIO_VALUE[ratio]}
        />
        <HudItem
          label='旋转'
          active={rotate !== 0}
          icon={<RotateSVG className={s.icon} />}
          value={`${rotate}°`}
        />
        <HudItem
          label='灯光'
          active={hasLight}
          icon={
            <span className={s.coverIcon}>
              <span
                className={cn(s.lightDot, hasLight && s.gridDotActive)}
                style={{
                  left: `${lightCenter.x * 100}%`,
                  top: `${lightCenter.y * 100}%`,
                }}
              />
            </span>
          }
        />
        <HudItem
          label='背景'
          active={wallpaper !== ''}
          icon={
            <span
              className={s.bgSwatch}
              style={{ background: parseWallpaper(wallpapers, wallpaper).background }}
            />
          }
          value={wallpaper || '0'}
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
