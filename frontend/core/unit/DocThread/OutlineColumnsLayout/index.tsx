import { mockHelpCats } from '~/mock'

import Category from './Category'
import useSalon from './salon'

export default function OutlineColumnsLayout() {
  const cats = mockHelpCats()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.cols}>
        {cats.map((cat, categoryIndex) => (
          <Category
            key={cat.id}
            categoryIndex={categoryIndex + 1}
            title={cat.title}
            color={cat.color}
            articles={cat.articles}
          />
        ))}
      </div>
    </div>
  )
}
