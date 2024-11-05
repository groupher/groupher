'use client'

// https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const dynamic = 'force-static'

import { EMAIL_SUPPORT } from '~/config'

import { COLOR_NAME } from '~/const/colors'

import useHover from '~/hooks/useHover'
import useThemeData from '~/hooks/useThemeData'

import HomeHeader from '~/widgets/HomeHeader'
import AnimatedCount from '~/widgets/AnimatedCount'
import { Link } from '~/widgets/Common'
import Button from '~/widgets/Buttons/Button'

import { FREE_PAN_ITEMS, PAID_PAN_ITEMS, CUSTOM_PAN_ITEMS } from './constant'
import Feature from './Feature'

import {
  Wrapper,
  InnerWrapper,
  BannerTitle,
  BannerDesc,
  Column,
  Board,
  TopTitle,
  Desc,
  Price,
  CoffeeIcon,
  LetsTalk,
  CancelNote,
  ButtonWrapper,
  CatPaw,
} from './styles'

export default () => {
  const [paidHoveredRef, paidHovered] = useHover<HTMLDivElement>()
  const themeData = useThemeData()

  return (
    <Wrapper>
      <HomeHeader />
      <BannerTitle>与用户社区一起，走的更远</BannerTitle>
      <BannerDesc>无套路，无广告，持续迭代，开放透明</BannerDesc>
      <InnerWrapper>
        <Column $color={COLOR_NAME.GREEN} $opacity={0.3}>
          <TopTitle $color={COLOR_NAME.GREEN}>免费</TopTitle>
          <Desc>您的产品刚刚起步，需要公共空间和潜在用户交流探讨。</Desc>
          <Price>0</Price>
          <CancelNote>可随时升级或注销</CancelNote>
          <Board>
            {FREE_PAN_ITEMS.map((item) => (
              <Feature key={item.key} title={item.title} color={COLOR_NAME.GREEN} />
            ))}
          </Board>
          <ButtonWrapper>
            <Button ghost>创建社区实例</Button>
          </ButtonWrapper>
        </Column>
        <Column ref={paidHoveredRef} $color={COLOR_NAME.ORANGE} $opacity={0.6}>
          <CatPaw
            src="landing/catpaw.png"
            top={paidHovered ? 158 : 75}
            left={paidHovered ? 0 : 12}
          />
          <TopTitle $color={COLOR_NAME.BROWN}>交个朋友</TopTitle>
          <Desc>您的产品已有一定规模，希望解锁社区更多功能获得进一步增长。</Desc>
          <Price>
            <AnimatedCount
              count={paidHovered ? 9 : 0}
              forceColor={themeData.article.title}
              left={5}
              size="huge"
            />
            .9 &nbsp;&nbsp;
          </Price>
          <CancelNote $hide={!paidHovered} $color={COLOR_NAME.BROWN}>
            内测折扣价，可随时退款
          </CancelNote>

          <Board>
            {PAID_PAN_ITEMS.map((item) => (
              <Feature key={item.key} title={item.title} color={COLOR_NAME.ORANGE} />
            ))}
          </Board>
          <ButtonWrapper>
            <Button>开始 30 天试用</Button>
          </ButtonWrapper>
        </Column>
        <Column $color={COLOR_NAME.PURPLE} $opacity={0.4}>
          <TopTitle $color={COLOR_NAME.PURPLE}>定制开发</TopTitle>
          <Desc>您的产品需要更加个性化的功能，我们可提供量身定做服务。</Desc>
          <LetsTalk>
            <CoffeeIcon />
            一起聊聊吧
          </LetsTalk>
          <CancelNote>对社区产品有想法？让我们知道！</CancelNote>
          <Board>
            {CUSTOM_PAN_ITEMS.map((item) => (
              <Feature key={item.key} title={item.title} color={COLOR_NAME.PURPLE} />
            ))}
          </Board>
          <ButtonWrapper>
            <Link href={`mailto:${EMAIL_SUPPORT}`}>
              <Button ghost>联系我们</Button>
            </Link>
          </ButtonWrapper>
        </Column>
      </InnerWrapper>
    </Wrapper>
  )
}
