import { type FC, useState } from 'react'

import type { TArticle } from '~/spec'
import { mockUsers } from '~/mock'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import Facepile from '~/widgets/Facepile'

import useLogic from '../useLogic'
import useSalon from '../salon/cards_layout/category'

const FOLD_LIMIT = 5

type TProps = {
  title: string
  desc: string
  articles: TArticle[]
}

const Category: FC<TProps> = ({ title, desc, articles }) => {
  const s = useSalon()

  const { gotoDetailLayout } = useLogic()
  const [sliceCount, setSliceCount] = useState(FOLD_LIMIT)

  return (
    <div className={s.wrapper}>
      <div className={s.paperMask} />
      <div className={s.inner}>
        <div className={s.header}>
          <div className={s.topping}>
            <div className={s.updateDate}>2022-3-4</div>
            <Facepile users={mockUsers(2)} total={3} />
          </div>

          <h3 className={s.title}>{title}</h3>
          <div className={s.desc}>
            We are proud today to introduce the production-ready Next.js 8, featuring:
          </div>
        </div>

        <div className={s.items}>
          {articles.slice(0, sliceCount).map((article) => (
            <div className={s.item} key={article.id} onClick={() => gotoDetailLayout()}>
              {article.title}
            </div>
          ))}
        </div>

        {articles.length >= FOLD_LIMIT && (
          <div className={s.footer}>
            {articles.length >= FOLD_LIMIT && sliceCount <= FOLD_LIMIT && (
              <ArrowButton down onClick={() => setSliceCount(articles.length)}>
                查看全部
              </ArrowButton>
            )}

            {articles.length >= FOLD_LIMIT && sliceCount > FOLD_LIMIT && (
              <ArrowButton up onClick={() => setSliceCount(FOLD_LIMIT)} initWidth={26}>
                收起
              </ArrowButton>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Category
