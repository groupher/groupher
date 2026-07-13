import { components } from 'react-select'

import useSalon, { cnMerge } from './salon'

export default function CustomOption(props) {
  const s = useSalon({ ...(props.selectProps?.spacing ?? {}) })
  const { label, icon } = props.data
  const Icon = icon || null
  const isActive = props.isSelected || props.isFocused

  return (
    <components.Option {...props}>
      <div className={s.optionRow}>
        {icon && <Icon className={s.icon} />}
        <span className={cnMerge(s.optionTitle, isActive && s.optionTitleActive)}>{label}</span>
      </div>
    </components.Option>
  )
}
