import { type FC, memo } from 'react'
import { isEmpty } from 'ramda'

import { Row } from '~/widgets/Common'

import Favicon from './Favicon'
import type { TCommunityType } from '../../spec'
import { COMMUNITY_CATS_COLOR, COMMUNITY_CATS_TEXT_COLORS } from '../../constant'

import {
  Header,
  Tab,
  TabContent,
  AddressBar,
  ToolbarWrapper,
  BackIcon,
  RefreshIcon,
  ForwardIcon,
  LockIcon,
  MoreIcon,
  StarIcon,
  Form,
  Input,
  Slash,
  SubDomain,
  ThreadPath,
  ThreadText,
} from '../../styles/content/fake_browser/browser_head'

type TProps = {
  domain?: string
  title?: string
  desc?: string
  activePath: string
  logo?: string | null
  communityType: TCommunityType
}

const BrowserHead: FC<TProps> = ({
  domain = '',
  title = '',
  activePath = '',
  logo = null,
  communityType,
}) => {
  const tabTitle = title || domain || 'groupher'
  const domainColors = COMMUNITY_CATS_TEXT_COLORS[communityType]

  return (
    <>
      <Header>
        <Tab>
          <Favicon title={title} logo={logo} />
          <TabContent>{tabTitle}</TabContent>
        </Tab>
      </Header>
      <AddressBar>
        <ToolbarWrapper>
          <BackIcon />
          <ForwardIcon />
          <RefreshIcon />
        </ToolbarWrapper>
        <Form>
          <LockIcon />
          <Input>
            {isEmpty(domain) ? (
              <div>groupher.com</div>
            ) : (
              <Row>
                groupher.com<Slash>/</Slash>
                <SubDomain $colors={domainColors}>{domain.toLowerCase()}</SubDomain>
                <ThreadPath $active={!!activePath}>
                  <Slash>/</Slash>
                  <ThreadText>{activePath}</ThreadText>
                </ThreadPath>
              </Row>
            )}
            <div className="grow" />
            <StarIcon $color={COMMUNITY_CATS_COLOR[communityType]} />
          </Input>
        </Form>
        <MoreIcon />
      </AddressBar>
    </>
  )
}

export default memo(BrowserHead)
