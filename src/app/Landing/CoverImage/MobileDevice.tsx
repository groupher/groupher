import useWallpaper from '~/hooks/useWallpaper'

import { Wrapper, Content, Image, Background, Bar } from '../salon/cover_image/mobile_device'

export default () => {
  const { background, effect } = useWallpaper()

  const imageSrc = '/landing/intro/mobile.png'

  return (
    <Wrapper>
      <Bar />
      <Content>
        <Image src={imageSrc} noLazy />
        <Background style={{ background }} effect={effect} />
      </Content>
    </Wrapper>
  )
}
