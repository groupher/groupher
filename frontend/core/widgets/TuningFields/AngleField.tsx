import AngleWheelControl from '~/widgets/AngleWheel'

import RangeField from './RangeField'

type Props = {
  label?: string
  value: number
  onChange: (angle: number) => void
  onCommit?: () => void
}

export default function AngleField({ label = 'Angle', value, onChange, onCommit }: Props) {
  return (
    <RangeField label={label}>
      <AngleWheelControl value={value} label={label} onChange={onChange} onCommit={onCommit} />
    </RangeField>
  )
}
