import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import { mockImage } from '~/mock'
import type { TArticle } from '~/spec'

import useLogic from '../useLogic'
import useSalon from './salon/category'

type TProps = {
  title: string
  desc: string
  articles: (TArticle & { desc?: string })[]
}

const Category: FC<TProps> = ({ title, desc, articles }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { gotoDetailLayout } = useLogic()

  return (
    <section className={s.section}>
      <h3 className={s.title}>{title}</h3>
      <div className={s.sectionDesc}>{desc}</div>

      <div className={s.cards}>
        {articles.map((article) => (
          <button
            key={article.id}
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
              <div className={s.desc}>{article.desc || t('doc.thread.no_desc')}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

export default Category
