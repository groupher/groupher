import type { FC } from 'react'

import styled, { css, animate, rainbow, theme } from '~/css'
import type { TColor, TActive } from '~/spec'
import { ARTICLE_CAT, ARTICLE_STATE } from '~/const/gtd'
import PinSVG from '~/icons/Pin'
import UnPinSVG from '~/icons/UnPin'
//
import SpinSVG from '~/icons/Spin'
import EditSVG from '~/icons/EditPen'
import CategorySVG from '~/icons/Category'
import SlugSVG from '~/icons/Slug'
import MergeSVG from '~/icons/Merge'
import ArchivedSVG from '~/icons/Archived'
import DeleteSVG from '~/icons/Trash'
import LockSVG from '~/icons/LockLight'
import ArrowSVG from '~/icons/ArrowSimple'
import ArticleMirror from '~/icons/MirrorShoe'

import LightSVG from '~/icons/ColorLight'
import QuestionSVG from '~/icons/Question'
import BugSVG from '~/icons/ColorBug'
import DiscussSVG from '~/icons/Discuss'

import TodoSVG from '~/icons/GtdTodo'
import WipSVG from '~/icons/GtdWip'
import DoneSVG from '~/icons/GtdDone'
import RejectSVG from '~/icons/Reject'

// import OtherSVG from '~/icons/menu/Feedback'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill } = useTwBelt()

  return {
    icon: cn('size-3.5 mr-1.5', fill('text.digest'), `group-hover:${fill('text.title')}`),
  }
}

const commonIcon = (comp): FC => {
  return styled(comp)`
    ${css.size(13)};
    fill: ${theme('article.digest')};
    margin-right: 6px;

    
  `
}

type TGTDItem = TActive & TColor

export const Icon = {
  Arrow: styled(commonIcon(ArrowSVG))`
    transform: rotate(180deg);
    ${css.size(15)};
    opacity: 0.5;
  `,
  Edit: commonIcon(EditSVG),
  Category: styled(commonIcon(CategorySVG))`
    ${css.size(12)};
    margin-left: 1px;
    margin-right: 7px;
    margin-top: 1px;
  `,
  State: commonIcon(WipSVG),
  [ARTICLE_STATE.TODO]: styled(commonIcon(TodoSVG))<TGTDItem>`
    fill: ${({ $color, $active }) => ($active ? rainbow($color) : theme('article.digest'))};
  `,
  [ARTICLE_STATE.WIP]: styled(commonIcon(WipSVG))<TGTDItem>`
    fill: ${({ $color, $active }) => ($active ? rainbow($color) : theme('article.digest'))};
    ${css.size(14)};
  `,
  [ARTICLE_STATE.DONE]: styled(commonIcon(DoneSVG))<TGTDItem>`
    fill: ${({ $color, $active }) => ($active ? rainbow($color) : theme('article.digest'))};
    margin-left: 1px;
  `,
  [ARTICLE_STATE.REJECT]: styled(commonIcon(RejectSVG))<TGTDItem>`
    fill: ${({ $active }) => ($active ? rainbow('red') : theme('article.digest'))};
    margin-left: 1px;
  `,

  Slug: commonIcon(SlugSVG),
  Archived: commonIcon(ArchivedSVG),
  Merge: commonIcon(MergeSVG),
  Lock: commonIcon(LockSVG),
  Delete: styled(commonIcon(DeleteSVG))`
    ${css.size(14)};
    margin-top: 1px;
  `,
  Pin: styled(commonIcon(PinSVG))`
    margin-top: 2px;
  `,
  UnPin: styled(commonIcon(UnPinSVG))`
    ${css.size(15)};
    margin-left: -1px;
  `,
  Spin: styled(commonIcon(SpinSVG))`
    ${css.size(11)};
    animation: ${animate.rotate360} 0.8s linear infinite;
  `,
  Mirror: commonIcon(ArticleMirror),
  [ARTICLE_CAT.FEATURE]: commonIcon(LightSVG),
  [ARTICLE_CAT.QUESTION]: commonIcon(QuestionSVG),
  [ARTICLE_CAT.BUG]: commonIcon(BugSVG),
  [ARTICLE_CAT.OTHER]: styled(commonIcon(DiscussSVG))`
    ${css.size(12)};
    margin-left: 1px;
  `,
}

export const holder = 1
