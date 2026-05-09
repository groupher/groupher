/*
 *
 * ArticleCatStatus
 *
 */

import type { FC } from 'react'

import { ARTICLE_CAT, ARTICLE_STATUS } from '~/const/gtd'
import type { TArticleCat, TArticleStatus, TSpace } from '~/spec'

import Label from './Label'
import useSalon from './salon'
import Status from './Status'

export type TProps = {
  testid?: string
  cat?: TArticleCat
  status?: TArticleStatus
  smaller?: boolean
  noBorder?: boolean
  // size?
} & TSpace

const ArticleCatStatus: FC<TProps> = ({
  testid: _testid = 'article-cat-status',
  cat = ARTICLE_CAT.IDEA,
  status = ARTICLE_STATUS.DEFAULT,
  smaller = true,
  noBorder = false,
  ...spacing
}) => {
  const s = useSalon({ noBorder, ...spacing })

  return (
    <div className={s.wrapper}>
      {cat && <Label cat={cat} smaller={smaller} />}
      {cat && cat !== ARTICLE_CAT.DISCUSSION && (
        <Status cat={cat} status={status} smaller={smaller} />
      )}
    </div>
  )
}

export default ArticleCatStatus
