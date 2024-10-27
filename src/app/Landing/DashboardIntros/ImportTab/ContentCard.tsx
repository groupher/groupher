import HeaderCard from './HeaderCard'
import Content from './Content'
import FooterCard from './FooterCard'

import {
  Wrapper,
  BgBubble,
  Bot,
  AI,
  HLineIcon,
  HLineIcon2,
  //
  LineIcon,
  LineIcon2,
  CurveLineIcon1,
  CurveLineIcon2,
  CurveLineIcon3,
  CurveLineIcon4,
} from '../../styles/dashboard_intros/import_tab/content_card'

export default () => {
  return (
    <Wrapper>
      <Bot top={230} left={40}>
        Bot
      </Bot>
      <AI top={230} right={50}>
        AI
      </AI>
      {/* <LeftBgBubble />
      <RightBgBubble /> */}
      <BgBubble />
      <HLineIcon />
      <HLineIcon2 />

      <LineIcon />
      <LineIcon2 />
      <CurveLineIcon1 />
      <CurveLineIcon2 />
      <CurveLineIcon3 />
      <CurveLineIcon4 />

      <HeaderCard />
      <Content />
      <FooterCard />
    </Wrapper>
  )
}
