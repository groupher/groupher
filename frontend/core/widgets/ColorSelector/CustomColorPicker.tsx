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
  SliderTrack,
} from 'react-aria-components'

import ThemeSectionSelector from '~/widgets/ThemeSectionSelector'
import useSalon from './salon/custom_color_picker'

type TProps = {
  color: string
  onChange: (color: string) => void
}

const ColorSelectorPicker: FC<TProps> = ({ color, onChange }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ThemeSectionSelector top={4} bottom={3} />

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

          <ColorSlider className={s.slider} colorSpace='hsb' channel='hue'>
            <SliderTrack className={s.sliderTrack}>
              <ColorThumb
                className={s.colorSliderThumb}
                style={{ top: '50%', transform: 'translate(-50%, -50%)' }}
              />
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
