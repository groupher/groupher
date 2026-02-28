import { includes, isEmpty, pluck, reject } from 'ramda'
import { type FC, useCallback, useEffect, useState } from 'react'

import type { TMenuOption } from '~/spec'
import type { TProps as TIndex } from '..'
import useSalon from '../salon/left_right'
import { DEFAULT_MENU, MENU } from './constant'
import Left from './Left'
import Section from './Section'

type TProps = Pick<TIndex, 'sections'>

const LeftRight: FC<TProps> = ({ sections }) => {
  const s = useSalon()

  const [openedIndexes, setOpenedIndexes] = useState<number[]>([])
  const [_menuOptions, setMenuOptions] = useState<TMenuOption[]>(DEFAULT_MENU)

  useEffect(() => {
    const articleIds = pluck('index', sections)
    if (isEmpty(openedIndexes)) {
      setMenuOptions([MENU.UNFOLD_ALL, MENU.AUTH_EDIT])
    } else if (openedIndexes.length === articleIds.length) {
      setMenuOptions([MENU.FOLD_ALL, MENU.AUTH_EDIT])
    } else {
      setMenuOptions(DEFAULT_MENU)
    }
  }, [openedIndexes, sections])

  // fold/unfold one item
  const toggle = useCallback(
    (id) => {
      includes(id, openedIndexes)
        ? setOpenedIndexes(reject((_id) => _id === id, openedIndexes))
        : setOpenedIndexes([id, ...openedIndexes])
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
