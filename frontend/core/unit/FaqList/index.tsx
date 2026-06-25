/*
 *
 * FaqList
 *
 */

import { type FC, memo } from 'react'

import { DOC_FAQ_LAYOUT } from '~/const/layout'
import type { TArticle, TDocFAQLayout, TDocFaq, TFAQSection, TSpace } from '~/spec'
// import { FAQ as DefaultFAQ } from '~/const/landingPage'

import Collapse from './Collapse'
import Flat from './Flat'
import LeftRight from './LeftRight'
import useSalon from './salon'
import SearchHint from './SearchHint'

export type TProps = {
  testid?: string
  layout?: TDocFAQLayout
  articles?: TArticle[]
  large?: boolean
  docFaq?: TDocFaq
  sections?: TFAQSection[]
} & TSpace

const DEFAULT_SECTIONS: TFAQSection[] = []

const flattenDocFaq = (docFaq?: TDocFaq): TFAQSection[] => {
  if (!docFaq) return DEFAULT_SECTIONS

  if (docFaq.groupedView) {
    return docFaq.groupItems.flatMap((group) =>
      group.items.map((item) => ({
        id: `${group.id}:${item.id}`,
        title: item.title,
        body: item.detail,
        index: item.index,
      })),
    )
  }

  return docFaq.flatItems.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.detail,
    index: item.index,
  }))
}

const FaqList: FC<TProps> = ({
  testid: _testid = 'faq-list',
  layout = DOC_FAQ_LAYOUT.FLAT,
  docFaq,
  sections = DEFAULT_SECTIONS,
  large = false,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })
  const resolvedSections = docFaq ? flattenDocFaq(docFaq) : sections

  return (
    <div className={s.wrapper}>
      {layout === DOC_FAQ_LAYOUT.FLAT && <Flat sections={resolvedSections} large={large} />}
      {layout === DOC_FAQ_LAYOUT.SEARCH_HINT && <SearchHint sections={resolvedSections} />}
      {layout === DOC_FAQ_LAYOUT.COLLAPSE && <Collapse sections={resolvedSections} />}
      {layout === DOC_FAQ_LAYOUT.LEFT_RIGHT && <LeftRight sections={resolvedSections} />}
    </div>
  )
}

export default memo(FaqList)
