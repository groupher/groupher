/* *
 * ChangelogThread
 *
 */

import usePagedChangelogs from '~/hooks/usePagedChangelogs'
import ChangelogItem from '~/widgets/ChangelogItem'

import Sidebar from './Sidebar'

import { Wrapper, MainWrapper } from '../styles/classic_layout'

export default () => {
  const { pagedChangelogs } = usePagedChangelogs()

  return (
    <Wrapper>
      <MainWrapper>
        {pagedChangelogs.entries.map((item) => (
          <ChangelogItem key={item.innerId} article={item} />
        ))}
      </MainWrapper>
      <Sidebar tagsMode="all" />
    </Wrapper>
  )
}
