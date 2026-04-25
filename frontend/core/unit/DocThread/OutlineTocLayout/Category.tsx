import type { FC } from 'react'
import type { TArticle } from '~/spec'
import useSalon from '../salon/outline_toc_layout/category'
import useLogic from '../useLogic'

type TProps = {
  title: string
  desc: string
  articles: TArticle[]
}

const Category: FC<TProps> = ({ title, _desc, articles }) => {
  const s = useSalon()
  const { gotoDetailLayout } = useLogic()

  return (
    <section className={s.wrapper}>
      <div className={s.title}>{title}</div>

      <div className={s.items}>
        {articles.map((article, articleIndex) => (
          <button
            key={article.id}
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
