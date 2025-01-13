/*
 * cards for job MasonryCards view
 */

import { type FC, memo } from 'react'

import type { TCommunity } from '~/spec'
import { cutRest } from '~/fmt'

import DotDivider from '~/widgets/DotDivider'
import {
  Wrapper,
  CommunityLogo,
  Info,
  SubInfo,
  SubsInfo,
  UserIcon,
  UserCount,
  Header,
  Title,
  Raw,
  Desc,
} from './styles/community_card'

type TProps = {
  item: TCommunity
}

const CommunityCard: FC<TProps> = ({ item: { logo, title, slug, desc } }) => {
  return (
    <Wrapper key={slug}>
      <Header>
        <CommunityLogo src={logo} />
        <Info>
          <Title>{title}</Title>
          <SubInfo>
            <Raw href={`/${slug}`} prefetch={false}>
              {slug}
            </Raw>
            <DotDivider className="mx-1.5" />
            <SubsInfo>
              <UserIcon />
              {/* <UserCount>{subscribersCount}</UserCount> */}
              <UserCount>74</UserCount>
            </SubsInfo>
          </SubInfo>
        </Info>
      </Header>
      <Desc>{cutRest(desc, 50)}</Desc>
    </Wrapper>
  )
}

export default memo(CommunityCard)
