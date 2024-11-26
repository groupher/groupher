import type { FC } from 'react'

import { mockHelpCats } from '~/mock'

import Category from './Category'
import useSalon from '../styles/lists_layout'

const ListsLayout: FC = () => {
  const s = useSalon()
  const cats = mockHelpCats()

  return (
    <div className={s.wrapper}>
      <div className={s.cats}>
        {cats.map((cat) => (
          <Category key={cat.id} color={cat.color} title={cat.title} desc={cat.desc} />
        ))}
      </div>
    </div>
  )
}

export default ListsLayout
