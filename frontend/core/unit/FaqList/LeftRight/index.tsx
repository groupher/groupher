import { includes, reject } from 'ramda'
import { type FC, useCallback, useState } from 'react'

import type { TProps as TIndex } from '..'
import useSalon from './salon'
import Left from './Left'
import Section from './Section'

type TProps = Pick<TIndex, 'sections'>

const LeftRight: FC<TProps> = ({ sections }) => {
  const s = useSalon()

  const [openedIndexes, setOpenedIndexes] = useState<number[]>([])

  // fold/unfold one item
  const toggle = useCallback(
    (id) => {
      if (includes(id, openedIndexes)) {
        setOpenedIndexes(reject((_id) => _id === id, openedIndexes))
      } else {
        setOpenedIndexes((prev) => [id, ...prev])
      }
    },
    [openedIndexes],
  )

  return (
    <div className={s.wrapper}>
      <Left />

      <div className={s.sections}>
        {sections.map((item) => (
          <Section key={item.index} item={item} openedIndexes={openedIndexes} toggle={toggle} />
        ))}
      </div>
    </div>
  )
}

export default LeftRight
