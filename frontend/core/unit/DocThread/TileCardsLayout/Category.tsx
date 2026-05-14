import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import type { TArticle, TColorName } from '~/spec'
import DotDivider from '~/widgets/DotDivider'
import Facepile from '~/widgets/Facepile'
import IconHub from '~/widgets/IconHub'

import useSalon from '../salon/tile_cards_layout/category'
import useLogic from '../useLogic'

type TProps = {
  title: string
  desc: string
  color: TColorName
  articles: TArticle[]
}

const Category: FC<TProps> = ({ title, desc, color, articles }) => {
  const s = useSalon({ color })
  const { t } = useTrans()
  const { gotoDetailLayout } = useLogic()
  const authorsCount =
    new Set(articles.flatMap((article) => article.author?.login || article.author?.id || []))
      .size || 2
  const articleCount = articles.length

  return (
    <button type='button' className={s.wrapper} onClick={() => gotoDetailLayout()}>
      <div className={s.iconBox}>
        <IconHub provider='fa' icon='star' size={20} color={color} opacity={0.7} />
      </div>

      <h3 className={s.title}>{title}</h3>
      <p className={s.desc}>{desc}</p>

      <div className={s.footer}>
        <Facepile users={mockUsers(2)} total={2} showMore={false} />
        <div className={s.count}>
          {authorsCount} {t(authorsCount > 1 ? 'doc.thread.authors' : 'doc.thread.author')}
        </div>
        <DotDivider className='mx-2' />
        <div className={s.count}>
          {articleCount} {t(articleCount > 1 ? 'doc.thread.articles' : 'doc.thread.article')}
        </div>
        <div className='grow' />
      </div>
    </button>
  )
}

export default Category
