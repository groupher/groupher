import { type FC, useState } from 'react'
import { mockUsers } from '~/mock'
import type { TArticle } from '~/spec'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import Facepile from '~/widgets/Facepile'
import useSalon from '../salon/cards_layout/category'
import useLogic from '../useLogic'

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
  const isFolded = sliceCount <= FOLD_LIMIT
  const handleToggleFold = () => setSliceCount(isFolded ? articles.length : FOLD_LIMIT)

  return (
    <div className={s.wrapper}>
      <div className={s.paperMask} />
      <div className={s.inner}>
        <div className={s.header}>
          <div className={s.topping}>
            <div className={s.updateDate}>2022-3-4</div>
            <div className='grow' />
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
          <button className={s.footer} onClick={handleToggleFold} type='button'>
            {isFolded && (
              <ArrowButton as='span' down scopeClassName='arrow-button-scope'>
                查看全部
              </ArrowButton>
            )}

            {!isFolded && (
              <ArrowButton as='span' up initWidth={26} scopeClassName='arrow-button-scope'>
                收起
              </ArrowButton>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default Category
