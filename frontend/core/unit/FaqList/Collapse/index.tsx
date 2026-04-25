import { includes, isEmpty, pluck, reject } from 'ramda'
import { type FC, useCallback, useEffect, useState } from 'react'

import type { TMenuOption } from '~/spec'
import type { TProps as TIndex } from '..'
import useSalon from '../salon/collapse'
import Banner from './Banner'
import { DEFAULT_MENU, MENU } from './constant'
import Footer from './Footer'
import Section from './Section'

type TProps = Pick<TIndex, 'sections'>

const Collapse: FC<TProps> = ({ sections }) => {
  const s = useSalon()

  const [openedIndexes, setOpenedIndexes] = useState<number[]>([])
  const [menuOptions, setMenuOptions] = useState<TMenuOption[]>(DEFAULT_MENU)

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
      if (includes(id, openedIndexes)) {
        setOpenedIndexes(reject((_id) => _id === id, openedIndexes))
      } else {
        setOpenedIndexes([id, ...openedIndexes])
      }
    },
    [openedIndexes],
  )

  return (
    <div className={s.wrapper}>
      <Banner menuOptions={menuOptions} setOpenedIndexes={setOpenedIndexes} sections={sections} />

      {sections.map((item) => (
        <Section key={item.index} item={item} openedIndexes={openedIndexes} toggle={toggle} />
      ))}

      <Footer />
    </div>
  )
}

export default Collapse
