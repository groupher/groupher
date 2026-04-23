import { mockHelpCats } from '~/mock'
import useSalon from '../salon/outline_columns_layout'
import Category from './Category'

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
