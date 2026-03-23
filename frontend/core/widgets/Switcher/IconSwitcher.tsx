/*
 *
 * IconSwitcher
 *
 */

import { findIndex, propEq } from 'ramda'
import type { FC } from 'react'

import Tooltip from '~/widgets/Tooltip'

import useSalon from './salon/icon_selector'

type TItem = {
  icon?: string
  key: string
  desc?: string
}

type TProps = {
  items: TItem[]
  activeKey: string
  onChange?: (item: TItem) => void
}

const IconSwitcher: FC<TProps> = ({ items, activeKey, onChange = console.log }) => {
  const s = useSalon()

  const slideIndex = findIndex(propEq(activeKey, 'key'), items)

  return (
    <div className={s.wrapper}>
      <div className={s.tabs}>
        {items.map((item) => {
          return (
            <Tooltip
              key={item.key}
              content={<div className={s.descText}>{item.desc}</div>}
              placement='top'
              delay={500}
              forceZIndex
              noPadding
            >
              <div className={s.label} onClick={() => onChange(item)}>
                <div>SVG</div>
              </div>
            </Tooltip>
          )
        })}
        {slideIndex !== -1 && (
          <div className={s.slider} style={{ transform: `translateX(${slideIndex * 100}%)` }} />
        )}
      </div>
    </div>
  )
}

export default IconSwitcher
