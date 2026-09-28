import type { FC } from 'react'

import type { TArticleState, TPost } from '~/spec'

import ArticleCard from '../../ArticleCard'

type TProps = {
  viewModel: TArticleState<TPost>
}

const MasonryLayout: FC<TProps> = ({ viewModel }) => {
  return <ArticleCard viewModel={viewModel} />
}

export default MasonryLayout
