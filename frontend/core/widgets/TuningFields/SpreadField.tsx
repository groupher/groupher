import useTrans from '~/hooks/useTrans'
import RangeInput from '~/widgets/RangeInput'

import RangeField from './RangeField'
import type { TRangeFieldProps } from './spec'

export default function SpreadField({
  label,
  value,
  width,
  onChange,
  onChangeEnd,
}: TRangeFieldProps) {
  const { t } = useTrans()
  const fieldLabel = label ?? t('dsb.appearance.wallpaper.editor.spread')

  return (
    <RangeField label={fieldLabel}>
      <RangeInput
        value={value}
        min={0}
        max={100}
        step={1}
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
