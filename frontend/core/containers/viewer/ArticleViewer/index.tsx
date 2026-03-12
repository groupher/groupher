'use client'
/*
 * ArticleViewer
 */
import Comments from '~/containers/unit/Comments'
import type { TArticleLoad } from '~/spec'
import DrawerHeader from './DrawerHeader'
import useSalon from './salon'

import useLogic from './useLogic'
import Viewer from './Viewer'

type TProps = TArticleLoad

export default (_props: TProps) => {
  const s = useSalon()
  const { article } = useLogic()

  if (!article) return null

  return (
    <div className={s.wrapper}>
      <DrawerHeader />
      <div className='relative'>
        <Viewer article={article} />

        <div className={s.comments}>
          <Comments />
        </div>
      </div>
    </div>
  )
}
