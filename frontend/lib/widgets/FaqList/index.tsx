/*
 *
 * FaqList
 *
 */

import { type FC, memo } from 'react'

import type { TArticle, TSpace, TDocFAQLayout, TFAQSection } from '~/spec'
import { DOC_FAQ_LAYOUT } from '~/const/layout'
// import { FAQ as DefaultFAQ } from '~/const/landingPage'

import Flat from './Flat'
import SearchHint from './SearchHint'
import Collapse from './Collapse'

import useSalon from './salon'

export type TProps = {
  testid?: string
  layout?: TDocFAQLayout
  articles?: TArticle[]
  large?: boolean
  sections?: TFAQSection[]
} & TSpace

const TEST_DATA = [
  {
    title: 'sldkjfie',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj ldksjdldsjdkc,nveekldj end',
    index: 0,
  },

  {
    title: 'sldkjfie',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj',
    index: 1,
  },

  {
    title: 'sldkjfie',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj',
    index: 2,
  },
  {
    title: 'sldkjfie',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj',
    index: 3,
  },
  {
    title: 'sldkjfie',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj',
    index: 4,
  },
  {
    title: 'sldkjfie',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj',
    index: 5,
  },
]

const FaqList: FC<TProps> = ({
  testid = 'faq-list',
  layout = DOC_FAQ_LAYOUT.FLAT,
  sections = [],
  large = false,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  sections = TEST_DATA

  return (
    <div className={s.wrapper}>
      {layout === DOC_FAQ_LAYOUT.FLAT && <Flat sections={sections} large={large} />}
      {layout === DOC_FAQ_LAYOUT.SEARCH_HINT && <SearchHint sections={sections} />}
      {layout === DOC_FAQ_LAYOUT.COLLAPSE && <Collapse sections={sections} />}
    </div>
  )
}

export default memo(FaqList)
