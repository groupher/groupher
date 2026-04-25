/*
 *
 * Radio
 *
 */

import type { FC } from 'react'
import SIZE from '~/const/size'
import type { TSizeSM, TSpace } from '~/spec'

import useSalon, { cn } from './salon/radio'

type TItem = {
  value: string
  key: string | boolean
  dimOnActive?: boolean
}

type TProps = {
  items: TItem[]
  activeKey: string | boolean
  size?: TSizeSM
  onChange?: (item: TItem) => void
} & TSpace

const Radio: FC<TProps> = ({
  items,
  activeKey,
  _size = SIZE.MEDIUM,
  onChange = console.log,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper} data-testid='radio'>
      {items.map((item) => {
        const active = item.key === activeKey

        return (
          <div
            key={item.value}
            className={cn(s.label, active && s.labelChecked)}
            onClick={() => onChange?.(item)}
          >
            <div className={cn(s.circle, active && s.checked)} />
            {item.value}
          </div>
        )
      })}
    </div>
  )
}

export default Radio
