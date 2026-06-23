import type { FC, KeyboardEvent } from 'react'

import useTrans from '~/hooks/useTrans'
import { mockUsers } from '~/mock'
import type { TArticle, TColorName } from '~/spec'
import DotDivider from '~/widgets/DotDivider'
import Facepile from '~/widgets/Facepile'
import IconHub from '~/widgets/IconHub'

import useLogic from '../useLogic'
import useSalon from './salon/category'

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
  const handleOpen = () => gotoDetailLayout()
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    handleOpen()
  }

  return (
    <div
      role='button'
      tabIndex={0}
      className={s.wrapper}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <div className={s.iconBox}>
        <IconHub provider='fa' icon='star' mode='mask' size={6} color={color} opacity={0.7} />
      </div>

      <h3 className={s.title}>{title}</h3>
      <p className={s.desc}>{desc}</p>

      <div className={s.footer}>
        <div onClick={(event) => event.stopPropagation()}>
          <Facepile users={mockUsers(2)} total={2} showMore={false} classNames={s.facepile} />
        </div>
        <div className={s.count}>
          {authorsCount} {t(authorsCount > 1 ? 'doc.thread.authors' : 'doc.thread.author')}
        </div>
        <DotDivider className='mx-2' />
        <div className={s.count}>
          {articleCount} {t(articleCount > 1 ? 'doc.thread.articles' : 'doc.thread.article')}
        </div>
        <div className='grow' />
      </div>
    </div>
  )
}

export default Category
