import RangeInput from '~/widgets/RangeInput'

import { COVER_SHADOW_COLOR_MODE, COVER_SHADOW_RANGE } from '../../../../constant'
import { useImageDraftContext } from '../../../../imageDraftContext'
import type { TCoverImageWhich, TCoverShadow } from '../../../../spec'
import useSalon from './salon/custom_fields'

type TProps = {
  showCustom: boolean
  shadow: TCoverShadow
  which: TCoverImageWhich
}

export default function CustomFields({ shadow, showCustom, which }: TProps) {
  const s = useSalon()
  const { flushImageDraft, scheduleImagePatch } = useImageDraftContext()
  const scheduleShadowPatch = (patch: Partial<TCoverShadow>): void =>
    scheduleImagePatch(which, { shadow: { ...shadow, ...patch } })
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
              scheduleShadowPatch(
                shadow.colorMode === COVER_SHADOW_COLOR_MODE.RAINBOW
                  ? { rainbowHue: nextValue }
                  : { hue: nextValue },
              )
            }}
            onChangeEnd={flushImageDraft}
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
                  onChange={(nextValue) => scheduleShadowPatch({ x: nextValue })}
                  onChangeEnd={flushImageDraft}
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
                  onChange={(nextValue) => scheduleShadowPatch({ y: nextValue })}
                  onChangeEnd={flushImageDraft}
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
              onChange={(nextValue) => scheduleShadowPatch({ blur: nextValue })}
              onChangeEnd={flushImageDraft}
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
              onChange={(nextValue) => scheduleShadowPatch({ spread: nextValue })}
              onChangeEnd={flushImageDraft}
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
              onChange={(nextValue) => scheduleShadowPatch({ opacity: nextValue })}
              onChangeEnd={flushImageDraft}
            />
          </div>
        </div>
      )}
    </>
  )
}
