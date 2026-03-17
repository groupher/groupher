import { useState } from 'react'

// import Header from '~/widgets/CommunityDigest/HeaderLayout'
import ViewportTracker from '~/widgets/ViewportTracker'
import useSalon from '../salon/post'
import Content from './Content'
import Digest from './Digest'

export default function Changelog() {
  const s = useSalon()
  const [_inViewport, setInViewport] = useState(false)

  return (
    <>
      <div className={s.banner}>
        <div className={s.main}>
          <Digest />
          <Content />
        </div>
        <h2>Side Info for Changelog</h2>
      </div>
      <ViewportTracker onEnter={() => setInViewport(true)} onLeave={() => setInViewport(false)} />
    </>
  )
}
