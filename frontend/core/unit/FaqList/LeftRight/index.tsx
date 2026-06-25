import { includes, reject } from 'ramda'
import { type FC, useCallback, useState } from 'react'

import type { TProps as TIndex } from '..'
import Left from './Left'
import useSalon from './salon'
import Section from './Section'

type TProps = Pick<TIndex, 'sections'>

const LeftRight: FC<TProps> = ({ sections }) => {
  const s = useSalon()

  const [openedIds, setOpenedIds] = useState<string[]>([])

  // fold/unfold one item
  const toggle = useCallback(
    (id) => {
      if (includes(id, openedIds)) {
        setOpenedIds(reject((_id) => _id === id, openedIds))
      } else {
        setOpenedIds((prev) => [id, ...prev])
      }
    },
    [openedIds],
  )

  return (
    <div className={s.wrapper}>
      <Left />

      <div className={s.sections}>
        {sections.map((item) => (
          <Section key={item.id} item={item} openedIds={openedIds} toggle={toggle} />
        ))}
      </div>
    </div>
  )
}

export default LeftRight
