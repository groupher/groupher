/*
 *
 * ArticleCatState
 *
 */

import type { FC } from 'react'

import type { TSpace, TArticleCat, TArticleState } from '~/spec'
import { ARTICLE_CAT, ARTICLE_STATE } from '~/const/gtd'

import State from './State'
import Label from './Label'

import useSalon from './salon'

export type TProps = {
  testid?: string
  cat?: TArticleCat
  state?: TArticleState
  smaller?: boolean
  noBorder?: boolean
  // size?
} & TSpace

const ArticleCatState: FC<TProps> = ({
  testid = 'article-cat-state',
  cat = ARTICLE_CAT.FEATURE,
  state = ARTICLE_STATE.DEFAULT,
  smaller = true,
  noBorder = false,
  ...spacing
}) => {
  const s = useSalon({ noBorder, ...spacing })

  return (
    <div className={s.wrapper}>
      {cat && <Label cat={cat} smaller={smaller} />}
      {cat && cat !== ARTICLE_CAT.OTHER && <State cat={cat} state={state} smaller={smaller} />}
    </div>
  )
}

export default ArticleCatState
