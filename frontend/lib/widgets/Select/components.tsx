import type { FC } from 'react'
import { components, type IndicatorSeparatorProps } from 'react-select'

import type { TSelectOption } from '~/spec'

import type { TSelectProps } from './spec'
import useSalon, { cn } from './salon/components'

/* @ts-ignore */
export const IndicatorsContainer: FC = (props: IndicatorSeparatorProps) => {
  return (
    <div style={{ background: 'transparent' }}>
      {/* @ts-ignore */}
      <components.IndicatorsContainer {...props} />
    </div>
  )
}

type TOption = {
  data: TSelectOption
  selectProps: TSelectProps
}

export const Option: FC<TOption> = (props) => {
  const s = useSalon()
  const { data, selectProps } = props

  return (
    // @ts-ignore
    <components.Option {...props}>
      <div className={s.optionRow}>
        <div
          className={cn(
            s.optionTitle,
            selectProps?.value?.value === data.value && s.optionTitleActive,
          )}
        >
          {data.label}
        </div>
        {data.desc && <div className={s.optionDesc}>{data.desc}</div>}
      </div>
    </components.Option>
  )
}
