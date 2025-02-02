import { useState } from 'react'

// import Header from '~/widgets/CommunityDigest/HeaderLayout'
import ViewportTracker from '~/widgets/ViewportTracker'

import Digest from './Digest'
import Content from './Content'
import SideInfo from './SideInfo'

import useSalon from '../salon/post'

export default () => {
  const s = useSalon()
  const [_inViewport, setInViewport] = useState(false)

  return (
    <>
      <div className={s.banner}>
        <div className={s.main}>
          <Digest />
          <Content />
        </div>
        <SideInfo />
      </div>
      <ViewportTracker onEnter={() => setInViewport(true)} onLeave={() => setInViewport(false)} />
    </>
  )
}
