import { useRef } from 'react'

// import Header from '~/ui/CommunityDigest/ClassicLayout'
import ViewportTracker from '~/ui/ViewportTracker'

import Content from './Content'
import Digest from './Digest'
import useSalon from './salon'
import SideInfo from './SideInfo'

export default function Changelog() {
  const s = useSalon()
  const inViewportRef = useRef(false)

  return (
    <>
      <div className={s.banner}>
        <div className={s.main}>
          <Digest />
          <Content />
        </div>
        <SideInfo />
      </div>
      <ViewportTracker
        onEnter={() => {
          inViewportRef.current = true
        }}
        onLeave={() => {
          inViewportRef.current = false
        }}
      />
    </>
  )
}
