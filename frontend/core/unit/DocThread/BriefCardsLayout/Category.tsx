import type { FC } from 'react'

import BookSVG from '~/icons/Book'
import type { TArticle } from '~/spec'

import useLogic from '../useLogic'
import useSalon from './salon/category'

type TProps = {
  title: string
  articles: (TArticle & { desc?: string })[]
}

const Category: FC<TProps> = ({ title, articles }) => {
  const s = useSalon()
  const { gotoDetailLayout } = useLogic()

  return (
    <section>
      <h3 className={s.title}>{title}</h3>

      <div className={s.items}>
        {articles.map((article) => (
          <button
            key={article.id}
            type='button'
            className={s.item}
            onClick={() => gotoDetailLayout()}
          >
            <BookSVG className={s.icon} />

            <div className='column'>
              <div className={s.itemTitle}>{article.title}</div>
              {article.desc ? <div className={s.itemDesc}>{article.desc}</div> : null}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default Category
