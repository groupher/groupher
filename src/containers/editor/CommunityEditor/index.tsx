/*
 *
 * CommunityEditor
 *
 */

import { useEffect } from 'react'

import useMetric from '~/hooks/useMetric'

import Header from './Header'
import Banner from './Banner'
import Content from './Content'

import useLogic from './useLogic'
import { Wrapper, InnerWrapper, ContentWrapper } from './styles'

export default () => {
  const metric = useMetric()
  const { checkPendingApply } = useLogic()

  useEffect(() => {
    checkPendingApply()
  }, [checkPendingApply])

  return (
    <Wrapper metric={metric}>
      <Header />
      <Banner />
      <InnerWrapper metric={metric}>
        <ContentWrapper>
          <Content />
        </ContentWrapper>
      </InnerWrapper>
    </Wrapper>
  )
}
