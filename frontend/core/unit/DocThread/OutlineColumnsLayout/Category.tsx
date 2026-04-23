import type { FC } from 'react'
import type { TArticle, TColorName } from '~/spec'
import useSalon from '../salon/outline_columns_layout/category'
import useLogic from '../useLogic'

type TProps = {
  categoryIndex: number
  title: string
  color: TColorName
  articles: TArticle[]
}

const Category: FC<TProps> = ({ categoryIndex, title, articles }) => {
  const s = useSalon()
  const { gotoDetailLayout } = useLogic()

  return (
    <section className={s.wrapper}>
      <h3 className={s.title}>
        <span className={s.titleIndex}>{`${categoryIndex}.0`}</span>
        <span>{title}</span>
      </h3>

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
            <span className={s.itemIndex}>{`${categoryIndex}.${articleIndex + 1}`}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default Category
