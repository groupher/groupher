import type { FC } from 'react'
import type { TArticle, TColorName } from '~/spec'
import useSalon from '../salon/outline_columns_layout/category'
import useLogic from '../useLogic'

type TProps = {
  title: string
  color: TColorName
  articles: TArticle[]
}

const Category: FC<TProps> = ({ title, color, articles }) => {
  const s = useSalon({ color })
  const { gotoDetailLayout } = useLogic()

  return (
    <section className={s.wrapper}>
      <h3 className={s.title}>{title}</h3>

      <div className={s.items}>
        {articles.map((article, articleIndex) => (
          <button
            key={`${article.id}-${articleIndex}`}
            type='button'
            className={s.item}
            onClick={() => gotoDetailLayout()}
          >
            <span className={s.articleTitle}>{article.title}</span>
            <span className={s.line} />
            <span className={s.itemIndex}>{articleIndex + 1}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default Category
