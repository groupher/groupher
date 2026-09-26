import type { FC } from 'react'

import type { TArticleListViewModel, TPost } from '~/spec'

import ArticleCard from '../../ArticleCard'

type TProps = {
  viewModel: TArticleListViewModel<TPost>
}

const MasonryLayout: FC<TProps> = ({ viewModel }) => {
  return <ArticleCard viewModel={viewModel} />
}

export default MasonryLayout
