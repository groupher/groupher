import { mockHelpCats } from '~/mock'
import useSalon from '../salon/outline_layout'
import Category from './Category'

export default function OutlineLayout() {
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
