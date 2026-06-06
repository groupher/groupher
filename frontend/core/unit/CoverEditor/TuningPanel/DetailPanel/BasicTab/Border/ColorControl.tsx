import type { CSSProperties } from 'react'
import { ColorSlider, ColorThumb, parseColor, SliderTrack } from 'react-aria-components'

import Tooltip from '~/widgets/Tooltip'

import { BORDER_HIGHLIGHT_COLOR } from '../../../../constant'
import {
  getBorderHighlightColor,
  normalizeBorderHighlightHue,
  normalizeBorderHighlightOpacity,
} from '../../../../helper'
import type { TBorderHighlight } from '../../../../spec'
import useLogic from '../../../../useLogic'
import useSalon, { cn } from './salon/controller'

type TProps = {
  borderHighlight: TBorderHighlight
}

type TSliderStyle = CSSProperties & {
  '--thumb-color'?: string
}

const CHECKER_LAYERS = [
  'linear-gradient(45deg, rgba(255, 255, 255, 0.65) 25%, transparent 25%) 0 0 / 8px 8px',
  'linear-gradient(-45deg, rgba(255, 255, 255, 0.65) 25%, transparent 25%) 0 4px / 8px 8px',
  'linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.65) 75%) 4px -4px / 8px 8px',
  'linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.65) 75%) -4px 0px / 8px 8px',
].join(', ')

const CHECKER_BASE_LAYER =
  'linear-gradient(rgba(128, 128, 128, 0.24), rgba(128, 128, 128, 0.24)) 0 0 / 100% 100% no-repeat'

const getHueTrackStyle = (): CSSProperties => ({
  background: `linear-gradient(to right,
    hsl(0, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(60, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(120, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(180, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(240, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(300, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%),
    hsl(360, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%))`,
})

const getOpacityTrackStyle = (hue: number): CSSProperties => ({
  background: [
    `linear-gradient(to right,
      hsla(${hue}, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%, 0),
      hsla(${hue}, ${BORDER_HIGHLIGHT_COLOR.SATURATION}%, ${BORDER_HIGHLIGHT_COLOR.LIGHTNESS}%, 1)) 0 0 / 100% 100% no-repeat`,
    CHECKER_LAYERS,
    CHECKER_BASE_LAYER,
  ].join(', '),
})

const getSwatchStyle = (color: string): CSSProperties => ({
  background: [
    `linear-gradient(${color}, ${color}) 0 0 / 100% 100% no-repeat`,
    CHECKER_LAYERS,
    CHECKER_BASE_LAYER,
  ].join(', '),
})

const formatOpacityPercent = (opacity: number): string => `${Math.round(opacity * 100)}%`

export default function ColorControl({ borderHighlight }: TProps) {
  const s = useSalon()
  const { borderHighlightOnChange } = useLogic()
  const hue = normalizeBorderHighlightHue(borderHighlight.hue)
  const opacity = normalizeBorderHighlightOpacity(borderHighlight.opacity)
  const color = getBorderHighlightColor({ hue, opacity })
  const opaqueColor = getBorderHighlightColor({ hue, opacity: 1 })
  const parsedColor = parseColor(color)
  const sliderStyle: TSliderStyle = { '--thumb-color': opaqueColor }

  return (
    <Tooltip
      placement='right'
      trigger='click'
      hideOnClick={false}
      maxWidth='none'
      offset={[8, 0]}
      content={
        <div className={s.colorPanel}>
          <div className={s.colorField}>
            <div className={s.colorMeta}>
              <span className={s.colorLabel}>Hue</span>
              <span className={s.colorValue}>{hue}°</span>
            </div>
            <ColorSlider
              aria-label='Border hue'
              className={s.colorSlider}
              value={parsedColor}
              colorSpace='hsl'
              channel='hue'
              style={sliderStyle}
              onChange={(nextColor) => {
                borderHighlightOnChange({
                  enabled: true,
                  hue: normalizeBorderHighlightHue(nextColor.getChannelValue('hue')),
                })
              }}
            >
              <SliderTrack className={s.colorSliderTrack} style={getHueTrackStyle()}>
                <ColorThumb className={s.colorThumb} />
              </SliderTrack>
            </ColorSlider>
          </div>

          <div className={s.colorField}>
            <div className={s.colorMeta}>
              <span className={s.colorLabel}>Opacity</span>
              <span className={s.colorValue}>{formatOpacityPercent(opacity)}</span>
            </div>
            <ColorSlider
              aria-label='Border opacity'
              className={s.colorSlider}
              value={parsedColor}
              colorSpace='hsl'
              channel='alpha'
              style={sliderStyle}
              onChange={(nextColor) => {
                borderHighlightOnChange({
                  enabled: true,
                  opacity: normalizeBorderHighlightOpacity(
                    Number(nextColor.getChannelValue('alpha').toFixed(2)),
                  ),
                })
              }}
            >
              <SliderTrack className={s.colorSliderTrack} style={getOpacityTrackStyle(hue)}>
                <ColorThumb className={s.colorThumb} />
              </SliderTrack>
            </ColorSlider>
          </div>
        </div>
      }
    >
      <button
        type='button'
        className={cn(s.colorTrigger, !borderHighlight.enabled && s.colorTriggerDisabled)}
        style={getSwatchStyle(color)}
        aria-label='Edit border color'
      />
    </Tooltip>
  )
}
