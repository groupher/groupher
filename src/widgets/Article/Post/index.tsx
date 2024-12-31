import { type FC, useState } from 'react'

// import Header from '~/widgets/CommunityDigest/HeaderLayout'
import ViewportTracker from '~/widgets/ViewportTracker'

import Digest from './Digest'
import Content from './Content'
import SideInfo from './SideInfo'

import { BannerContent, Main } from '../styles/post'

const Post: FC = () => {
  const [_inViewport, setInViewport] = useState(false)

  return (
    <>
      <BannerContent>
        <Main>
          <Digest />
          <Content />
        </Main>
        <SideInfo />
      </BannerContent>
      <ViewportTracker onEnter={() => setInViewport(true)} onLeave={() => setInViewport(false)} />
    </>
  )
}

export default Post
