import { components } from 'react-select'

import useSalon from './salon'

export default function CustomSingleValue(props) {
  const s = useSalon({ ...(props.selectProps?.spacing ?? {}) })
  const { label, icon } = props.data
  const Icon = icon || null

  return (
    <components.SingleValue {...props}>
      <div className={s.optionRow}>
        {icon && <Icon className={s.valueIcon} />}
        <span>{label}</span>
      </div>
    </components.SingleValue>
  )
}
