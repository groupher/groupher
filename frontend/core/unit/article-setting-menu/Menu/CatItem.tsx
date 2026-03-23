import type { FC } from 'react'
import useTrans from '~/hooks/useTrans'
import useViewingArticle from '~/hooks/useViewingArticle'
import ArrowSVG from '~/icons/ArrowSimple'
import CategorySVG from '~/icons/Category'

import { ICON } from '../constant'

import useSalon, { cn } from '../salon/menu'

type TProps = {
  onClick: () => void
}

const CatItem: FC<TProps> = ({ onClick }) => {
  const s = useSalon()
  const { t } = useTrans()

  const { article } = useViewingArticle()

  if (!article) return null

  if (article.cat) {
    const TheIcon = ICON[article.cat]

    return (
      <div className={s.menuItem} onClick={onClick}>
        <TheIcon />
        {t(article.cat)}
        <div className='grow' />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </div>
    )
  }

  return (
    <div className={s.menuItem} onClick={onClick}>
      <CategorySVG className={cn(s.icon, 'ml-px ')} />
      {t('article.cat')}
      <div className='grow' />
      <ArrowSVG className={cn(s.icon, 'rotate-180')} />
    </div>
  )
}

export default CatItem
