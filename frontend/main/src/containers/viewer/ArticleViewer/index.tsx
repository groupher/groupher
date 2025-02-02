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
import useSalon from './salon'

export default () => {
  const s = useSalon()
  const { article, loadArticle } = useLogic()

  useEffect(() => {
    loadArticle()
  }, [])

  if (!article) return <LavaLampLoading top={20} left={20} />

  return (
    <div className={s.wrapper}>
      <DrawerHeader />
      {/* @ts-ignore */}
      {/* <CollectionFolder /> */}
      <Viewer article={article} />

      <div className={s.comments}>
        <h3>TODO: comments (slow down the drawer)</h3>
        {/* <Comments /> */}
      </div>
    </div>
  )
}
