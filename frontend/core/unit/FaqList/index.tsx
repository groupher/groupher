/*
 *
 * FaqList
 *
 */

import { type FC, memo } from 'react'

import { DOC_FAQ_LAYOUT } from '~/const/layout'
import type { TArticle, TDocFAQLayout, TFAQSection, TSpace } from '~/spec'
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
  sections?: TFAQSection[]
} & TSpace

const TEST_DATA = [
  {
    title: '软件代码是开源的吗?',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj ldksjdldsjdkc,nveekldj end',
    index: 0,
  },

  {
    title: '前后端技术栈是怎样的?',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj',
    index: 1,
  },

  {
    title: '我可以部署在自己的服务器吗?',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj',
    index: 2,
  },
  {
    title: '我想集成到自己的系统，有公开的 API 可以用吗?',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj',
    index: 3,
  },
  {
    title: '可以设置多个管理员吗',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj',
    index: 4,
  },
  {
    title: '免费额度多少',
    body: 'dlskdjslddslkdjsldksjdldsjdkc,nveekldj',
    index: 5,
  },
]

const DEFAULT_SECTIONS: TFAQSection[] = []

const FaqList: FC<TProps> = ({
  testid: _testid = 'faq-list',
  layout = DOC_FAQ_LAYOUT.FLAT,
  sections: _sections = DEFAULT_SECTIONS,
  large = false,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })
  const resolvedSections = TEST_DATA

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
