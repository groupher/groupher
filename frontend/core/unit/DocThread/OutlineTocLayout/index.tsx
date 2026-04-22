import { mockHelpCats } from '~/mock'
import useSalon from '../salon/outline_toc_layout'
import Category from './Category'

export default function OutlineTocLayout() {
  const cats = mockHelpCats()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.cats}>
        {cats.map((cat, index) => (
          <Category
            key={cat.id}
            index={index}
            title={cat.title}
            desc={cat.desc}
            articles={cat.articles}
          />
        ))}
      </div>
    </div>
  )
}
