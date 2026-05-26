/*
 *
 * ColorSelector
 *
 */

import type { FC } from 'react'
import {
  ColorPicker as AriaColorPicker,
  ColorArea,
  ColorField,
  ColorSlider,
  ColorThumb,
  Input,
  parseColor,
  SliderTrack,
} from 'react-aria-components'

import ThemeSwitchPreview from '~/widgets/ThemeSwitch/Preview'

import useSalon from './salon/custom_color_picker'

type TProps = {
  color: string
  onChange: (color: string) => void
}

const ColorSelectorPicker: FC<TProps> = ({ color, onChange }) => {
  const s = useSalon()
  const thumbColor = parseColor(color).toString('hex')

  return (
    <div className={s.wrapper}>
      <ThemeSwitchPreview top={4} bottom={3} />

      <AriaColorPicker
        aria-label='Custom color picker'
        value={color}
        onChange={(nextColor) => onChange(nextColor.toString('hex'))}
      >
        <div className={s.pickerPanel}>
          <ColorArea
            className={s.colorArea}
            colorSpace='hsb'
            xChannel='saturation'
            yChannel='brightness'
          >
            <ColorThumb className={s.colorAreaThumb} />
          </ColorArea>

          <ColorSlider
            className={s.slider}
            colorSpace='hsb'
            channel='hue'
            style={{ ['--thumb-color' as string]: thumbColor }}
          >
            <SliderTrack className={s.sliderTrack}>
              <ColorThumb className={s.colorSliderThumb} />
            </SliderTrack>
          </ColorSlider>

          <div className={s.inputFooter}>
            <div className={s.inputLabel}>HEX</div>
            <ColorField className={s.colorField}>
              <Input aria-label='Custom color hex value' className={s.colorInput} />
            </ColorField>
          </div>
        </div>
      </AriaColorPicker>
    </div>
  )
}

export default ColorSelectorPicker
