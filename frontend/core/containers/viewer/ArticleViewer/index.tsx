'use client'
/*
 *
 * ArticleViewer
 *
 */
import { useEffect } from 'react'
import EVENT from '~/const/event'
import Comments from '~/containers/unit/Comments'
import { send } from '~/signal'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import type { TArticleLoad } from '~/spec'
import DrawerHeader from './DrawerHeader'
import useSalon from './salon'

import useLogic from './useLogic'
import Viewer from './Viewer'

type TProps = TArticleLoad 

export default (props: TProps) => {
  const s = useSalon()
  const { article, loadArticle } = useLogic()

  useEffect(() => {
    loadArticle(props)
  }, [])

  useEffect(() => {
    if (article) {
      send(EVENT.DRAWER.CONTENT_LOADED)
    }
  }, [article])

  if (!article) return <LavaLampLoading top={20} left={20} />

  return (
    <div className={s.wrapper}>
      <DrawerHeader />
      <Viewer article={article} />

      <div className={s.comments}>
        <Comments />
      </div>
    </div>
  )
}
