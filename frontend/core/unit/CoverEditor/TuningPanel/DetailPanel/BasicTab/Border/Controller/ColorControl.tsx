import {
  ColorSlider,
  ColorThumb,
  parseColor,
  Radio,
  RadioGroup,
  SliderTrack,
} from 'react-aria-components'

import SettingSVG from '~/icons/Setting'
import Tooltip from '~/widgets/Tooltip'

import { BORDER_HIGHLIGHT_DEFAULT, BORDER_HIGHLIGHT_MODE } from '../../../../../constant'
import {
  getBorderHighlightColor,
  getRainbowBorderHighlightColor,
  normalizeBorderHighlightLightness,
  normalizeBorderHighlightMode,
  normalizeBorderHighlightHue,
  normalizeBorderHighlightOpacity,
  normalizeBorderHighlightRainbowHue,
  normalizeBorderHighlightSaturation,
} from '../../../../../helper'
import type { TBorderHighlight, TCoverImageWhich } from '../../../../../spec'
import useLogic from '../../../../../useLogic'
import { COLOR_OPTION } from './constant'
import { getHueTrackStyle, getRainbowStyle, getSwatchStyle } from './helper'
import useSalon, { cn } from './salon/color_control'
import type { TSliderStyle } from './spec'

type TProps = {
  borderHighlight: TBorderHighlight
  variant?: 'swatch' | 'setting'
  which: TCoverImageWhich
}

export default function ColorControl({ borderHighlight, variant = 'swatch', which }: TProps) {
  const s = useSalon()
  const { borderHighlightOnChange } = useLogic()
  const mode = normalizeBorderHighlightMode(borderHighlight.mode)
  const hue = normalizeBorderHighlightHue(borderHighlight.hue)
  const rainbowHue = normalizeBorderHighlightRainbowHue(borderHighlight.rainbowHue)
  const saturation = normalizeBorderHighlightSaturation(borderHighlight.saturation)
  const lightness = normalizeBorderHighlightLightness(borderHighlight.lightness)
  const opacity = normalizeBorderHighlightOpacity(borderHighlight.opacity)
  const isRainbow = mode === BORDER_HIGHLIGHT_MODE.RAINBOW
  const isWhite = mode === BORDER_HIGHLIGHT_MODE.SOLID && saturation === 0 && lightness === 100
  const isBlack = mode === BORDER_HIGHLIGHT_MODE.SOLID && saturation === 0 && lightness === 0
  const isColor = mode === BORDER_HIGHLIGHT_MODE.SOLID && !isWhite && !isBlack
  const color = getBorderHighlightColor({ hue, saturation, lightness, opacity })
  const opaqueColor = getBorderHighlightColor({ hue, saturation, lightness, opacity: 1 })
  const rainbowColor = getRainbowBorderHighlightColor(0, opacity, rainbowHue)
  const opaqueRainbowColor = getRainbowBorderHighlightColor(0, 1, rainbowHue)
  const opacityColor = getBorderHighlightColor({
    hue: 0,
    saturation: 0,
    lightness: 55,
    opacity,
  })
  const parsedColor = parseColor(color)
  const parsedRainbowColor = parseColor(rainbowColor)
  const parsedOpacityColor = parseColor(opacityColor)
  const sliderStyle: TSliderStyle = {
    '--thumb-color': isRainbow ? opaqueRainbowColor : opaqueColor,
  }
  const opacitySliderStyle: TSliderStyle = {
    '--thumb-color': getBorderHighlightColor({
      hue: 0,
      saturation: 0,
      lightness: 55,
      opacity: 1,
    }),
  }
  const swatchStyle = isRainbow ? getRainbowStyle(rainbowHue) : getSwatchStyle(color)
  const optionValue = isRainbow
    ? COLOR_OPTION.RAINBOW
    : isWhite
      ? COLOR_OPTION.WHITE
      : isBlack
        ? COLOR_OPTION.BLACK
        : COLOR_OPTION.COLOR

  const selectSolidColor = (patch: Partial<TBorderHighlight>): void => {
    borderHighlightOnChange(which, {
      enabled: true,
      mode: BORDER_HIGHLIGHT_MODE.SOLID,
      ...patch,
    })
  }

  return (
    <Tooltip
      placement='right'
      trigger='click'
      hideOnClick={false}
      maxWidth='none'
      offset={[8, 0]}
      portalToBody
      content={
        <div className={s.colorPanel}>
          <RadioGroup
            aria-label='Border color mode'
            className={s.colorOptionRow}
            value={optionValue}
            onChange={(nextValue) => {
              switch (nextValue) {
                case COLOR_OPTION.WHITE:
                  selectSolidColor({
                    saturation: 0,
                    lightness: 100,
                    opacity: BORDER_HIGHLIGHT_DEFAULT.OPACITY,
                  })
                  break
                case COLOR_OPTION.BLACK:
                  selectSolidColor({
                    saturation: 0,
                    lightness: 0,
                    opacity: BORDER_HIGHLIGHT_DEFAULT.OPACITY,
                  })
                  break
                case COLOR_OPTION.COLOR:
                  selectSolidColor({
                    hue: BORDER_HIGHLIGHT_DEFAULT.HUE,
                    saturation: BORDER_HIGHLIGHT_DEFAULT.SATURATION,
                    lightness: BORDER_HIGHLIGHT_DEFAULT.LIGHTNESS,
                    opacity: BORDER_HIGHLIGHT_DEFAULT.OPACITY,
                  })
                  break
                case COLOR_OPTION.RAINBOW:
                  borderHighlightOnChange(which, {
                    enabled: true,
                    mode: BORDER_HIGHLIGHT_MODE.RAINBOW,
                    rainbowHue: BORDER_HIGHLIGHT_DEFAULT.RAINBOW_HUE,
                    opacity: BORDER_HIGHLIGHT_DEFAULT.OPACITY,
                  })
                  break
              }
            }}
          >
            <Radio className={s.colorOption} value={COLOR_OPTION.WHITE}>
              {({ isSelected }) => (
                <>
                  <span className={cn(s.colorRadio, isSelected && s.colorRadioActive)} />
                  <span className={s.colorOptionLabel}>White</span>
                </>
              )}
            </Radio>
            <Radio className={s.colorOption} value={COLOR_OPTION.BLACK}>
              {({ isSelected }) => (
                <>
                  <span className={cn(s.colorRadio, isSelected && s.colorRadioActive)} />
                  <span className={s.colorOptionLabel}>Black</span>
                </>
              )}
            </Radio>
            <Radio className={s.colorOption} value={COLOR_OPTION.COLOR}>
              {({ isSelected }) => (
                <>
                  <span className={cn(s.colorRadio, isSelected && s.colorRadioActive)} />
                  <span className={s.colorOptionLabel}>Color</span>
                </>
              )}
            </Radio>
            <Radio className={s.colorOption} value={COLOR_OPTION.RAINBOW}>
              {({ isSelected }) => (
                <>
                  <span className={cn(s.colorRadio, isSelected && s.colorRadioActive)} />
                  <span className={s.colorOptionLabel}>Rainbow</span>
                </>
              )}
            </Radio>
          </RadioGroup>

          <div className={s.colorSliderFields}>
            {isColor && (
              <div className={s.colorField}>
                <span className={s.colorLabel}>Hue</span>
                <ColorSlider
                  aria-label='Border hue'
                  className={s.colorSlider}
                  value={parsedColor}
                  colorSpace='hsl'
                  channel='hue'
                  style={sliderStyle}
                  onChange={(nextColor) => {
                    selectSolidColor({
                      hue: normalizeBorderHighlightHue(nextColor.getChannelValue('hue')),
                      saturation: BORDER_HIGHLIGHT_DEFAULT.SATURATION,
                      lightness: BORDER_HIGHLIGHT_DEFAULT.LIGHTNESS,
                    })
                  }}
                >
                  <SliderTrack className={s.colorSliderTrack}>
                    <span className={s.colorSliderRail} style={getHueTrackStyle()} />
                    <ColorThumb className={s.colorThumb} />
                  </SliderTrack>
                </ColorSlider>
              </div>
            )}

            {isRainbow && (
              <div className={s.colorField}>
                <span className={s.colorLabel}>Start</span>
                <ColorSlider
                  aria-label='Rainbow start'
                  className={s.colorSlider}
                  value={parsedRainbowColor}
                  colorSpace='hsl'
                  channel='hue'
                  style={sliderStyle}
                  onChange={(nextColor) => {
                    borderHighlightOnChange(which, {
                      enabled: true,
                      mode: BORDER_HIGHLIGHT_MODE.RAINBOW,
                      rainbowHue: normalizeBorderHighlightRainbowHue(
                        nextColor.getChannelValue('hue'),
                      ),
                    })
                  }}
                >
                  <SliderTrack className={s.colorSliderTrack}>
                    <span
                      className={s.colorSliderRail}
                      style={getRainbowStyle(rainbowHue, 'to right')}
                    />
                    <ColorThumb className={s.colorThumb} />
                  </SliderTrack>
                </ColorSlider>
              </div>
            )}

            <div className={s.colorField}>
              <span className={s.colorLabel}>Opacity</span>
              <ColorSlider
                aria-label='Border opacity'
                className={s.colorSlider}
                value={parsedOpacityColor}
                colorSpace='hsl'
                channel='alpha'
                style={opacitySliderStyle}
                onChange={(nextColor) => {
                  borderHighlightOnChange(which, {
                    enabled: true,
                    opacity: normalizeBorderHighlightOpacity(
                      Number(nextColor.getChannelValue('alpha').toFixed(2)),
                    ),
                  })
                }}
              >
                <SliderTrack className={s.opacitySliderTrack}>
                  <ColorThumb className={s.colorThumb} />
                </SliderTrack>
              </ColorSlider>
            </div>
          </div>
        </div>
      }
    >
      {variant === 'setting' ? (
        <button type='button' className={s.settingButton} aria-label='Edit border color'>
          <SettingSVG className={s.settingIcon} />
        </button>
      ) : (
        <button
          type='button'
          className={cn(s.colorTrigger, !borderHighlight.enabled && s.colorTriggerDisabled)}
          style={swatchStyle}
          aria-label='Edit border color'
        />
      )}
    </Tooltip>
  )
}
