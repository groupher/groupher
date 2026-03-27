import { find } from 'ramda'
import type { FC } from 'react'

import type { TSelectOption } from '~/spec'

import useSalon, { cn } from '../salon/banner/block_selector'

type TProps = {
  options: TSelectOption[]
  radius?: number
  onChange: (value: string) => void
  activeValue: string
  rounded?: boolean
}

const BlockSelector: FC<TProps> = ({ options, rounded = false, activeValue, onChange }) => {
  const s = useSalon({ rounded })
  const activeOption = find((item) => item.value === activeValue, options)

  return (
    <div className={s.wrapper}>
      {options.map((option) => (
        <div
          key={option.value}
          className={cn(s.block, activeOption?.value === option.value && s.blockActive)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </div>
      ))}
    </div>
  )
}

export default BlockSelector
