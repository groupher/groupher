import type { FC } from 'react'
import {
  components,
  type GroupBase,
  type IndicatorsContainerProps,
  type OptionProps,
} from 'react-select'

import type { TSelectOption } from '~/spec'

import useSalon, { cnMerge } from './salon/components'

export const IndicatorsContainer: FC<
  IndicatorsContainerProps<TSelectOption, boolean, GroupBase<TSelectOption>>
> = (props) => {
  return (
    <div style={{ background: 'transparent' }}>
      <components.IndicatorsContainer {...props} />
    </div>
  )
}

export const Option: FC<OptionProps<TSelectOption, boolean, GroupBase<TSelectOption>>> = (
  props,
) => {
  const s = useSalon()
  const { data } = props
  const isActive = props.isSelected

  return (
    <components.Option {...props}>
      <div className={s.optionRow}>
        <div
          className={cnMerge(s.optionTitle, isActive && s.optionTitleActive)}
        >
          {data.label}
        </div>
        {data.desc && <div className={s.optionDesc}>{data.desc}</div>}
      </div>
    </components.Option>
  )
}
