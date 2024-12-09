import { type FC, memo, useState, useCallback, useEffect } from 'react'
import { isEmpty, includes, reject, pluck } from 'ramda'

import type { TMenuOption } from '~/spec'

import { MENU, DEFAULT_MENU } from './constant'

import Banner from './Banner'
import Section from './Section'
import Footer from './Footer'

import useSalon from '../salon/collapse'

import type { TProps as TIndex } from '..'

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
      includes(id, openedIndexes)
        ? setOpenedIndexes(reject((_id) => _id === id, openedIndexes))
        : setOpenedIndexes([id, ...openedIndexes])
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

export default memo(Collapse)
