import type { FC } from 'react'

import type { TSpace } from '~/spec'

import useSalon from '../../salon/basic_info/danger_zone/list'

type TProps = {
  items: string[]
} & TSpace

const List: FC<TProps> = ({ items, ...spacing }) => {
  const s = useSalon({ ...spacing })

  return (
    <ul className={s.wrapper}>
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
        <li className={s.item} key={index}>
          {item}
        </li>
      ))}
    </ul>
  )
}

export default List
