import { useState } from 'react'

// import Header from '~/widgets/CommunityDigest/HeaderLayout'
import ViewportTracker from '~/widgets/ViewportTracker'
import useSalon from './salon'
import Content from './Content'
import Digest from './Digest'
import SideInfo from './SideInfo'

export default function Post() {
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
