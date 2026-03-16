import { mockHelpCats } from '~/mock'

import Category from './Category'
import useSalon from '../salon/blocks_layout'

export default function BlocksLayout() {
  const s = useSalon()
  const cats = mockHelpCats()

  return (
    <div className={s.wrapper}>
      <div className={s.cats}>
        {cats.map((cat) => (
          <Category key={cat.id} color={cat.color} title={cat.title} articles={cat.articles} />
        ))}
      </div>
    </div>
  )
}
