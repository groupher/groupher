/*
 *
 * PostItem
 *
 */

import type { FC } from 'react'

import { POST_LAYOUT } from '~/const/layout'
import type { TArticleState, TPost, TPostLayout } from '~/spec'

import CoverLayout from './CoverLayout'
import MasonryLayout from './MasonryLayout'
import MinimalLayout from './MinimalLayout'
import PHLayout from './PHLayout'
import QuoraLayout from './QuoraLayout'

type TProps = {
  viewModel: TArticleState<TPost>
  isMobilePreview?: boolean
  layout?: TPostLayout
}

const PostItem: FC<TProps> = ({ viewModel, layout = POST_LAYOUT.QUORA }) => {
  switch (layout) {
    case POST_LAYOUT.MINIMAL: {
      return <MinimalLayout viewModel={viewModel} />
    }

    case POST_LAYOUT.PH: {
      return <PHLayout viewModel={viewModel} />
    }

    case POST_LAYOUT.COVER: {
      return <CoverLayout viewModel={viewModel} />
    }

    case POST_LAYOUT.MASONRY: {
      return <MasonryLayout viewModel={viewModel} />
    }

    default: {
      return <QuoraLayout viewModel={viewModel} />
    }
  }
}

export default PostItem
