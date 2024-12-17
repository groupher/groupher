/*
 *
 * ArticleFooter
 *
 */

import { type FC, memo } from 'react'

import Panel from './Panel'

type TProps = {
  testid?: string
}

const ArticleFooter: FC<TProps> = ({ testid = 'article-footer' }) => {
  return (
    <>
      <Panel />
    </>
  )
}

export default memo(ArticleFooter)
