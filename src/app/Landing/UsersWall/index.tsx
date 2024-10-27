import type { FC, ReactNode } from 'react'

import type { TColorName } from '~/spec'

import { COLOR_NAME } from '~/const/colors'
import { mockUsers } from '~/mock'

import { DesktopOnly } from '~/widgets/Common'
import MasonryCards from '~/widgets/MasonryCards'

import Card from './Card'
import {
  Wrapper,
  Slogan,
  Title,
  Desc,
  Wall,
  WallInner,
  BgGradient,
  DempP,
  Highlight,
} from '../salon/users_wall'

const P1 = (markColor: TColorName): ReactNode => (
  <DempP>
    从 Github Discussions 迁移到 Groupher 以后，
    <Highlight $color={markColor}>国内访问体验拉满</Highlight>
    ，收集到的用户反馈也更加有针对性，很好的解决了
    <Highlight $color={markColor}>我们和用户</Highlight>之间的交流需求。
  </DempP>
)

const P2 = (markColor: TColorName): ReactNode => (
  <DempP>
    作为一个小团队，实在没有精力每天维护多个微信群，Groupher 完全是一个
    <Highlight $color={markColor}>定制化的交流社区</Highlight>， 沉淀了功能请求和问题反馈等
    ，让各种讨论可以<Highlight $color={markColor}>随时检索回溯</Highlight>，
    <p>更新日志的板块设计巧妙</p>
  </DempP>
)

const P3 = (markColor: TColorName): ReactNode => (
  <DempP>
    其他全国所有的省份，没有一个人均产量超过700公斤的，其中2021年
    <Highlight $color={markColor}>新疆，安徽，河南三省</Highlight>
    人均都是600多公斤，辽宁省人均刚好600公斤，这四个省份也是最接近
    黑吉蒙的，但是可以看出人均也只有黑吉蒙的一半都不到。
    {/* <Br /> */}
    <p>
      我们再说四川省，四川省 一直被认为是中国的
      <Highlight $color={markColor}>战略备份省份</Highlight>
      ，除了地势易守难攻，地理位置远离强敌之外，四川省在资源禀赋方面也是有自己的优势的。
    </p>
  </DempP>
)

const CardsList = () => {
  const users = mockUsers(10)

  return (
    <MasonryCards column={3}>
      <Card content={P1(COLOR_NAME.BLUE)} user={users[0]} color={COLOR_NAME.BLUE} />
      <Card content={P2(COLOR_NAME.ORANGE)} user={users[1]} color={COLOR_NAME.ORANGE} />
      <Card content={P1(COLOR_NAME.RED)} user={users[2]} color={COLOR_NAME.RED} />
      <Card content={P1(COLOR_NAME.GREEN)} user={users[3]} color={COLOR_NAME.GREEN} />
      <Card content={P3(COLOR_NAME.CYAN)} user={users[4]} color={COLOR_NAME.CYAN} />
      <Card content={P1(COLOR_NAME.PURPLE)} user={users[5]} color={COLOR_NAME.PURPLE} />
      <Card content={P2(COLOR_NAME.YELLOW)} user={users[6]} color={COLOR_NAME.YELLOW} />
      <Card content={P1(COLOR_NAME.BLUE)} user={users[7]} color={COLOR_NAME.BLUE} />
      <Card content={P1(COLOR_NAME.BROWN)} user={users[8]} color={COLOR_NAME.BROWN} />
    </MasonryCards>
  )
}

type TProps = {
  wallpaper: string
}

const UsersWall: FC<TProps> = ({ wallpaper }) => {
  return (
    <Wrapper>
      <Slogan>
        <Title>被众多优秀开发者和团队青睐</Title>
        <Desc>从独立开发者到中小型创业团队，我们用产品力回报信任</Desc>
      </Slogan>
      <BgGradient wallpaper={wallpaper} />

      <Wall>
        <WallInner>
          <CardsList />
        </WallInner>

        <DesktopOnly width="auto">
          <CardsList />
        </DesktopOnly>
      </Wall>
    </Wrapper>
  )
}

export default UsersWall
