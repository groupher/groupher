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

const getMenuOptions = (openedIds: string[], articleIds: string[]): TMenuOption[] => {
  if (isEmpty(openedIds)) {
    return [MENU.UNFOLD_ALL, MENU.AUTH_EDIT]
  }

  if (openedIds.length === articleIds.length) {
    return [MENU.FOLD_ALL, MENU.AUTH_EDIT]
  }

  return DEFAULT_MENU
}

const Collapse: FC<TProps> = ({ sections }) => {
  const s = useSalon()

  const [openedIds, setOpenedIds] = useState<string[]>([])
  const articleIds = pluck('id', sections)
  const menuOptions = getMenuOptions(openedIds, articleIds)

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
      <Banner menuOptions={menuOptions} setOpenedIds={setOpenedIds} sections={sections} />

      {sections.map((item) => (
        <Section key={item.id} item={item} openedIds={openedIds} toggle={toggle} />
      ))}

      <Footer />
    </div>
  )
}

export default Collapse
