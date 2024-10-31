import useWallpaper from '~/hooks/useWallpaper'

import DesktopDevice from './DesktopDevice'
import DashboardDevice from './DashboardDevice'
import MobileDevice from './MobileDevice'

import { Wrapper, ParallaxWrapper, FreeLabel } from '../salon/cover_image'

export default () => {
  const { wallpaper } = useWallpaper()

  return (
    <Wrapper>
      <DesktopDevice />
      <FreeLabel wallpaper={wallpaper}>It's free !</FreeLabel>
      <ParallaxWrapper>
        <DashboardDevice />
        <MobileDevice />
      </ParallaxWrapper>
    </Wrapper>
  )
}
