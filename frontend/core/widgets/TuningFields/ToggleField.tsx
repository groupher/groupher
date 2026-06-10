import SIZE from '~/const/size'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import RangeField from './RangeField'

type Props = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export default function ToggleField({ label, checked, onChange }: Props) {
  return (
    <RangeField label={label}>
      <ToggleSwitch size={SIZE.TINY} checked={checked} aria-label={label} onChange={onChange} />
    </RangeField>
  )
}
