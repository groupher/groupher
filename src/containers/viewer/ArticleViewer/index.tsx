/*
 *
 * ArticleViewer
 *
 */
import { useEffect } from 'react'

// import Comments from '~/containers/unit/Comments'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import DrawerHeader from './DrawerHeader'
import Viewer from './Viewer'

import useLogic from './useLogic'
import { Wrapper, CommentsWrapper } from './styles'

export default () => {
  const { article, loadArticle } = useLogic()

  useEffect(() => {
    loadArticle()
  }, [])

  if (!article) return <LavaLampLoading top={20} left={20} />

  return (
    <Wrapper $testid="article-viewer">
      <DrawerHeader />
      {/* @ts-ignore */}
      {/* <CollectionFolder /> */}
      <Viewer article={article} />

      <CommentsWrapper>
        <h3>TODO: comments (slow down the drawer)</h3>
        {/* <Comments /> */}
      </CommentsWrapper>
    </Wrapper>
  )
}
