'use client'

import useViewing from '~/hooks/useViewing'
import usePagedChangelogs from '~/hooks/usePagedChangelogs'

import { P } from '~/schemas'

import { getPagedArticles } from '../../../actions'

import useLinkMount from '~/hooks/useLinkMount'
import ChangelogThread from '~/containers/thread/ChangelogThread'
import { THREAD } from '~/const/thread'

const CommunityChangelogPage = () => {
  const { setActiveThread } = useViewing()
  const { update, pagedParams } = usePagedChangelogs()
  // const { update, pagedParams } = usePagedChangelogs()
  // const {community, filter} = useClientPagedArticlesParams()
  // usage: await getPagedChangelogs(community, filter)

  const loader = async () => {
    console.warn('## -> load real changelog data in client!: ', pagedParams)

    const result = await getPagedArticles(P.pagedChangelogs, pagedParams)
    console.log('## paged changelog: result: ', result)

    // const res = await fetch('/api/articles')
    // console.log('## 西八 res: ', res)

    update(result)
    setActiveThread(THREAD.CHANGELOG)
  }

  useLinkMount(loader)

  return <ChangelogThread />
}

export default CommunityChangelogPage
