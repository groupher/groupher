import RangeInput from '~/widgets/RangeInput'

import { COVER_SHADOW_COLOR_MODE, COVER_SHADOW_RANGE } from '../../../../constant'
import type { TCoverShadow } from '../../../../spec'
import useLogic from '../../../../useLogic'
import useSalon from './salon/custom_fields'

type TProps = {
  showCustom: boolean
  shadow: TCoverShadow
}

export default function CustomFields({ shadow, showCustom }: TProps) {
  const s = useSalon()
  const { shadowOnChange } = useLogic()
  const showHue =
    shadow.colorMode === COVER_SHADOW_COLOR_MODE.COLOR ||
    shadow.colorMode === COVER_SHADOW_COLOR_MODE.RAINBOW

  return (
    <>
      {showHue && (
        <div className={s.fieldRow}>
          <span className={s.fieldLabel}>
            {shadow.colorMode === COVER_SHADOW_COLOR_MODE.RAINBOW ? 'Rainbow' : 'Hue'}
          </span>
          <RangeInput
            value={
              shadow.colorMode === COVER_SHADOW_COLOR_MODE.RAINBOW ? shadow.rainbowHue : shadow.hue
            }
            min={COVER_SHADOW_RANGE.HUE.MIN}
            max={COVER_SHADOW_RANGE.HUE.MAX}
            step={1}
            width='w-full'
            valueLabel='Shadow hue'
            aria-label='Shadow hue'
            hideLabel
            unit='deg'
            onChange={(nextValue) => {
              shadowOnChange(
                shadow.colorMode === COVER_SHADOW_COLOR_MODE.RAINBOW
                  ? { rainbowHue: nextValue }
                  : { hue: nextValue },
              )
            }}
          />
        </div>
      )}

      {showCustom && (
        <div className={s.customFields}>
          <div className={s.fieldRow}>
            <span className={s.fieldLabel}>Offset</span>
            <div className={s.offsetFields}>
              <div className={s.offsetField}>
                <span className={s.axisLabel}>X</span>
                <RangeInput
                  value={shadow.x}
                  min={COVER_SHADOW_RANGE.X.MIN}
                  max={COVER_SHADOW_RANGE.X.MAX}
                  step={1}
                  width='w-full'
                  valueLabel='X'
                  aria-label='Shadow horizontal offset'
                  hideLabel
                  unit='px'
                  onChange={(nextValue) => shadowOnChange({ x: nextValue })}
                />
              </div>
              <div className={s.offsetField}>
                <span className={s.axisLabel}>Y</span>
                <RangeInput
                  value={shadow.y}
                  min={COVER_SHADOW_RANGE.Y.MIN}
                  max={COVER_SHADOW_RANGE.Y.MAX}
                  step={1}
                  width='w-full'
                  valueLabel='Y'
                  aria-label='Shadow vertical offset'
                  hideLabel
                  unit='px'
                  onChange={(nextValue) => shadowOnChange({ y: nextValue })}
                />
              </div>
            </div>
          </div>

          <div className={s.fieldRow}>
            <span className={s.fieldLabel}>Blur</span>
            <RangeInput
              value={shadow.blur}
              min={COVER_SHADOW_RANGE.BLUR.MIN}
              max={COVER_SHADOW_RANGE.BLUR.MAX}
              step={1}
              width='w-full'
              valueLabel='Blur'
              aria-label='Shadow blur radius'
              hideLabel
              unit='px'
              onChange={(nextValue) => shadowOnChange({ blur: nextValue })}
            />
          </div>

          <div className={s.fieldRow}>
            <span className={s.fieldLabel}>Spread</span>
            <RangeInput
              value={shadow.spread}
              min={COVER_SHADOW_RANGE.SPREAD.MIN}
              max={COVER_SHADOW_RANGE.SPREAD.MAX}
              step={1}
              width='w-full'
              valueLabel='Spread'
              aria-label='Shadow spread radius'
              hideLabel
              unit='px'
              onChange={(nextValue) => shadowOnChange({ spread: nextValue })}
            />
          </div>

          <div className={s.fieldRow}>
            <span className={s.fieldLabel}>Opacity</span>
            <RangeInput
              value={shadow.opacity}
              min={COVER_SHADOW_RANGE.OPACITY.MIN}
              max={COVER_SHADOW_RANGE.OPACITY.MAX}
              step={0.01}
              width='w-full'
              valueLabel='Opacity'
              aria-label='Shadow opacity'
              hideLabel
              unit=''
              formatValue={(value) => value.toFixed(2)}
              onChange={(nextValue) => shadowOnChange({ opacity: nextValue })}
            />
          </div>
        </div>
      )}
    </>
  )
}
