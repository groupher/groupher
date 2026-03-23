import type { FC } from 'react'

import { mockHelpCats } from '~/mock'
import useSalon from '../salon/lists_layout'
import Category from './Category'

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
