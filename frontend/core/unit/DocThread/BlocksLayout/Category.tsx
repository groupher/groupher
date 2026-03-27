import { type FC, memo, useState } from 'react'

import type { TArticle, TColorName } from '~/spec'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import FaIcons from '~/widgets/FaIcons'
import useSalon from '../salon/blocks_layout/category'
import useLogic from '../useLogic'

const FOLD_LIMIT = 5

type TProps = {
  color: TColorName
  title: string
  articles: TArticle[]
}

const Category: FC<TProps> = ({ color, title, articles }) => {
  const s = useSalon({ color })

  const { gotoDetailLayout } = useLogic()
  const [sliceCount, setSliceCount] = useState(FOLD_LIMIT)

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.iconBox}>
          <FaIcons icon='music' size={15} color={color} opacity={0.6} />
        </div>
        <h4 className={s.title}>{title}</h4>
      </div>

      <div className={s.itemsWrapper}>
        {articles.slice(0, sliceCount).map((article) => (
          <div className={s.item} key={article.id} onClick={() => gotoDetailLayout()}>
            {article.title}
          </div>
        ))}
      </div>

      {articles.length >= FOLD_LIMIT && sliceCount <= FOLD_LIMIT && (
        <ArrowButton down onClick={() => setSliceCount(articles.length)} top={3} left={-1}>
          查看全部
        </ArrowButton>
      )}

      {articles.length >= FOLD_LIMIT && sliceCount > FOLD_LIMIT && (
        <ArrowButton up onClick={() => setSliceCount(FOLD_LIMIT)} top={3} left={-1}>
          收起
        </ArrowButton>
      )}
    </div>
  )
}

export default memo(Category)
