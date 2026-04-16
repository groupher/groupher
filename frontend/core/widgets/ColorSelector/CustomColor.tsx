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

import useSalon from './salon/custom_color'

type TProps = {
  //
}

const ColorSelector: FC<TProps> = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <AriaColorPicker aria-label='Custom color picker' defaultValue='#8B5CF6'>
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

          <ColorField className={s.colorField}>
            <Input className={s.colorInput} />
          </ColorField>
        </div>
      </AriaColorPicker>
    </div>
  )
}

export default ColorSelector
