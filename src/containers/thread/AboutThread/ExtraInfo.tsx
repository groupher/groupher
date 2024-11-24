import { isEmpty } from 'ramda'

import useAboutInfo from '~/hooks/useAboutInfo'
import { SexyDivider as Divider } from '~/widgets/Common'
import SocialList from '~/widgets/SocialList'

import LabelList from './LabelList'
import MediaReports from './MediaReports'

import { Wrapper, Block, Title } from './salon/extra_info'

const Content = () => {
  const { cities, techstacks, socialLinks, mediaReports } = useAboutInfo()

  const noMediaReports = mediaReports.length <= 1 && !mediaReports[0].title

  return (
    <>
      <Divider bottom={40} top={0} />
      <Block hide={isEmpty(cities)}>
        <Title>所在地</Title>
        <LabelList items={cities} left={-2} />
      </Block>

      <Block>
        <Title>技术栈</Title>
        <LabelList items={techstacks} left={-2} />
      </Block>
      <Divider bottom={40} />
      <Block hide={isEmpty(socialLinks)}>
        <Title>关注我们</Title>
        <SocialList size="small" selected={socialLinks} left={-10} top={12} />
      </Block>

      <Block hide={noMediaReports}>
        <Title>媒体报道</Title>
        <MediaReports items={mediaReports} />
      </Block>
      <Divider bottom={40} />
    </>
  )
}

export default () => {
  return (
    <Wrapper>
      <Content />
    </Wrapper>
  )
}
