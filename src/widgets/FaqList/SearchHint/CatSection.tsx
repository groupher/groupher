import type { FC } from 'react'
import Link from 'next/link'

import type { TArticle, TColorName } from '~/spec'

import useSalon from '../salon/search_hint/cat_section'

type TProps = {
  item: {
    title: string
    desc: string
    color: TColorName
    articles: TArticle[]
  }
}

const CatSection: FC<TProps> = ({ item }) => {
  const s = useSalon({ color: item.color })

  return (
    <div className={s.wrapper}>
      <div className={s.bar} />
      <Link href="/" className={s.catItem}>
        {item.title}
      </Link>
      <div className={s.catDesc}>{item.articles.length} 篇内容</div>
    </div>
  )
}

export default CatSection
