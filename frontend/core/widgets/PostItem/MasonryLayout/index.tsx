import type { FC } from 'react'

import type { TPost } from '~/spec'

import ArticleCard from '~/widgets/ArticleCard'

type TProps = {
  article: TPost
}

const MasonryLayout: FC<TProps> = ({ article }) => {
  return <ArticleCard data={article} />
}

export default MasonryLayout
