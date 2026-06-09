import useTrans from '~/hooks/useTrans'
import RangeInput from '~/widgets/RangeInput'

import RangeField from './RangeField'
import type { TRangeFieldProps } from './spec'

export default function BrightnessField({
  label,
  value,
  width,
  onChange,
  onChangeEnd,
}: TRangeFieldProps) {
  const { t } = useTrans()
  const fieldLabel = label ?? t('dsb.appearance.wallpaper.editor.brightness')

  return (
    <RangeField label={fieldLabel}>
      <RangeInput
        value={value}
        min={60}
        max={140}
        step={5}
        width={width}
        hideLabel
        valueLabel={fieldLabel}
        aria-label={fieldLabel}
        onChange={onChange}
        onChangeEnd={onChangeEnd}
      />
    </RangeField>
  )
}
