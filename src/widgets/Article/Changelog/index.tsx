import { useState } from 'react'

import useViewingArticle from '~/hooks/useViewingArticle'

import Header from '~/widgets/CommunityDigest/HeaderLayout'
import ViewportTracker from '~/widgets/ViewportTracker'

import Digest from './Digest'
import Content from './Content'

import useSalon from '../salon/changelog'

export default () => {
  const s = useSalon()
  const { article } = useViewingArticle()

  const [_inViewport, setInViewport] = useState(false)

  return (
    <div className={s.wrapper}>
      {/* <FixedHeader show={!inViewport} article={viewingArticle} metric={metric} /> */}
      <div className={s.header}>
        <Header />
      </div>
      <div className={s.banner}>
        <div className={s.main}>
          <Digest article={article} />
          <Content article={article} />
        </div>
      </div>
      <ViewportTracker onEnter={() => setInViewport(true)} onLeave={() => setInViewport(false)} />
    </div>
  )
}
