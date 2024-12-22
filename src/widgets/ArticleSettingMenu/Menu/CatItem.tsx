import type { FC } from 'react'

import useViewingArticle from '~/hooks/useViewingArticle'
import { Trans } from '~/i18n'

import CategorySVG from '~/icons/Category'
import ArrowSVG from '~/icons/ArrowSimple'

import { ICON } from '../constant'

import useSalon, { cn } from '../styles/menu'

type TProps = {
  onClick: () => void
}

const CatItem: FC<TProps> = ({ onClick }) => {
  const s = useSalon()

  const { article } = useViewingArticle()

  if (!article) return null

  if (article.cat) {
    const TheIcon = ICON[article.cat]

    return (
      <div className={s.menuItem} onClick={onClick}>
        <TheIcon />
        {Trans(article.cat)}
        <div className="grow" />
        <ArrowSVG className={cn(s.icon, 'rotate-180')} />
      </div>
    )
  }

  return (
    <div className={s.menuItem} onClick={onClick}>
      <CategorySVG className={cn(s.icon, 'ml-px ')} />
      分类
      <div className="grow" />
      <ArrowSVG className={cn(s.icon, 'rotate-180')} />
    </div>
  )
}

export default CatItem
