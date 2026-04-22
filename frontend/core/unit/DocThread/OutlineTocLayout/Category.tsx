import type { FC } from 'react'
import type { TArticle } from '~/spec'
import useSalon from '../salon/outline_toc_layout/category'
import useLogic from '../useLogic'

type TProps = {
  index: number
  title: string
  desc: string
  articles: TArticle[]
}

const Category: FC<TProps> = ({ index, title, desc, articles }) => {
  const s = useSalon()
  const { gotoDetailLayout } = useLogic()

  return (
    <section className={s.wrapper}>
      <div className={s.title}>{title}</div>

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
            <span className={s.itemIndex}>{index * 5 + articleIndex + 1} Mins</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default Category
