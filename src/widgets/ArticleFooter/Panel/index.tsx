/*
 *
 * AuthorInfo
 *
 */

import { type FC, memo, useState } from 'react'

// import useAccount from '~/hooks/useAccount'
import Tabs from '~/widgets/Switcher/Tabs'

import Activities from './Activities'
import Members from './Members'

import { TAB_ITEMS, TAB_ACTIVITIES, TAB_MEMBERS } from '../constant'
import { Wrapper, TabsWrapper, ContentWrapper } from '../styles/panel'

// import { onFollow, undoFollow } from '../logic'

type TProps = {
  testid?: string
}

const Panel: FC<TProps> = ({ testid = 'author-info' }) => {
  // const author = useAccount()

  const [tab, setTab] = useState(TAB_ACTIVITIES)

  return (
    <Wrapper $testid={testid}>
      <TabsWrapper>
        <Tabs items={TAB_ITEMS} size="small" activeKey={tab} onChange={(tab) => setTab(tab)} />
      </TabsWrapper>
      <ContentWrapper>
        {tab === TAB_ACTIVITIES && <Activities />}
        {tab === TAB_MEMBERS && <Members />}
      </ContentWrapper>
    </Wrapper>
  )
}

export default memo(Panel)
