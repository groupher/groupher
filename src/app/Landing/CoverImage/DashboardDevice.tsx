import { Wrapper, Content, Image } from '../salon/cover_image/dashboard_device'

export default () => {
  const imageSrc = '/landing/intro/dashboard.png'

  return (
    <Wrapper>
      <Content>
        <Image src={imageSrc} />
      </Content>
    </Wrapper>
  )
}
