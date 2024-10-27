import type { FC } from 'react'

import ContentCard from './ContentCard'

import { Wrapper } from '../../salon/dashboard_intros/trend_tab'

const TrendTab: FC = () => {
  return (
    <Wrapper>
      <ContentCard />
    </Wrapper>
  )
}

export default TrendTab
