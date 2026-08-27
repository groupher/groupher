import type { FC } from 'react'

import Comment from './Comment'
import ContentCheck from './ContentCheck'
import DiffStatus from './DiffStatus'
import DocInfo from './DocInfo'
import EditToggle from './EditToggle'
import ImportContent from './ImportContent'
import More from './More'

const ArticleActions: FC = () => {
  return (
    <>
      <EditToggle />
      <DocInfo />
      <DiffStatus />
      <ImportContent />
      <ContentCheck />
      <Comment />
      <More />
    </>
  )
}

export default ArticleActions
