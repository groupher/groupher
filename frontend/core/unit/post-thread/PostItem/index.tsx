/*
 *
 * PostItem
 *
 */

import dynamic from 'next/dynamic'
import type { FC } from 'react'
import { POST_LAYOUT } from '~/const/layout'
import type { TPost, TPostLayout } from '~/spec'

const CoverLayout = dynamic(() => import('./CoverLayout'), { ssr: true })
const MasonryLayout = dynamic(() => import('./MasonryLayout'), { ssr: true })
const MinimalLayout = dynamic(() => import('./MinimalLayout'), { ssr: true })
const PHLayout = dynamic(() => import('./PHLayout'), { ssr: true })
const QuoraLayout = dynamic(() => import('./QuoraLayout'), { ssr: true })

type TProps = {
  article: TPost
  isMobilePreview?: boolean
  layout?: TPostLayout
}

const PostItem: FC<TProps> = ({ article, layout = POST_LAYOUT.QUORA }) => {
  switch (layout) {
    case POST_LAYOUT.MINIMAL: {
      return <MinimalLayout article={article} />
    }

    case POST_LAYOUT.PH: {
      return <PHLayout article={article} />
    }

    case POST_LAYOUT.COVER: {
      return <CoverLayout article={article} />
    }

    case POST_LAYOUT.MASONRY: {
      return <MasonryLayout article={article} />
    }

    default: {
      return <QuoraLayout article={article} />
    }
  }
}

export default PostItem
