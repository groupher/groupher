import type { FC } from 'react'
import { mockImage } from '~/mock'
import type { TArticle } from '~/spec'
import useSalon from '../salon/cover_cards_layout/category'
import useLogic from '../useLogic'

type TProps = {
  title: string
  desc: string
  articles: (TArticle & { desc?: string })[]
}

const Category: FC<TProps> = ({ title, desc, articles }) => {
  const s = useSalon()
  const { gotoDetailLayout } = useLogic()

  return (
    <section className={s.section}>
      <h3 className={s.title}>{title}</h3>
      <div className={s.sectionDesc}>{desc}</div>

      <div className={s.cards}>
        {articles.map((article, index) => (
          <button
            key={`${article.id}-${index}`}
            type='button'
            className={s.wrapper}
            onClick={() => gotoDetailLayout()}
          >
            <div
              className={s.cover}
              style={{
                backgroundImage: `url(${mockImage()})`,
              }}
            />

            <div className={s.content}>
              <div className={s.articleTitle}>{article.title}</div>
              <div className={s.desc}>{article.desc || '暂无描述'}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default Category
