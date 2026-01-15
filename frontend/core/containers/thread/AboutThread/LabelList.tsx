import type { FC } from 'react'
import { Trans } from '~/i18n'
import type { TSpace } from '~/spec'

import useSalon from './salon/label_list'

type TProps = {
  items: string[]
} & TSpace

const LabelList: FC<TProps> = ({ items, ...spacing }) => {
  const s = useSalon(spacing)

  return (
    <div className={s.wrapper}>
      {items.map((item: string) => (
        <div key={item} className={s.label}>
          {Trans(item)}
        </div>
      ))}
    </div>
  )
}

export default LabelList
