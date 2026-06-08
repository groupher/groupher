import { includes, isEmpty, pluck, reject } from 'ramda'
import { type FC, useCallback, useState } from 'react'

import type { TMenuOption } from '~/spec'

import type { TProps as TIndex } from '..'
import Banner from './Banner'
import { DEFAULT_MENU, MENU } from './constant'
import Footer from './Footer'
import useSalon from './salon'
import Section from './Section'

type TProps = Pick<TIndex, 'sections'>

const getMenuOptions = (openedIndexes: number[], articleIds: number[]): TMenuOption[] => {
  if (isEmpty(openedIndexes)) {
    return [MENU.UNFOLD_ALL, MENU.AUTH_EDIT]
  }

  if (openedIndexes.length === articleIds.length) {
    return [MENU.FOLD_ALL, MENU.AUTH_EDIT]
  }

  return DEFAULT_MENU
}

const Collapse: FC<TProps> = ({ sections }) => {
  const s = useSalon()

  const [openedIndexes, setOpenedIndexes] = useState<number[]>([])
  const articleIds = pluck('index', sections)
  const menuOptions = getMenuOptions(openedIndexes, articleIds)

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
      <Banner menuOptions={menuOptions} setOpenedIndexes={setOpenedIndexes} sections={sections} />

      {sections.map((item) => (
        <Section key={item.index} item={item} openedIndexes={openedIndexes} toggle={toggle} />
      ))}

      <Footer />
    </div>
  )
}

export default Collapse
