import Link from 'next/link'

import type { TMetric, TArticleTitle } from '~/spec'
import METRIC from '~/const/metric'
import styled, { css, theme, rainbow } from '~/css'

import Img from '~/Img'
import ArrowSVG from '~/icons/Arrow'
import DotDivider from '~/widgets/DotDivider'

export const Wrapper = styled.div<{ metric: TMetric }>`
  ${css.row('align-start', 'justify-between')};
  width: 100%;
  margin-top: 50px;
  position: relative;
`
export const LeftPart = styled.div`
  flex-grow: 1;
  max-width: 600px;
`
export const Topping = styled.div`
  ${css.row('align-both')};
  margin-left: -2px;
  margin-bottom: 16px;
  padding-right: 30px;
  position: relative;
`
export const BackBtnWrapper = styled.div`
  ${css.row('align-both')};
  padding: 2px 5px;
  border-radius: 8px;
  color: ${theme('article.digest')};

  &:hover {
    background: ${theme('hoverBg')};
    color: ${theme('article.title')};
    cursor: pointer;
  }

  transition: all 0.2s;
`
export const ArrowIcon = styled(ArrowSVG)`
  ${css.size(12)};
  fill: ${theme('article.digest')};
  margin-right: 5px;
  opacity: 0.6;

  ${BackBtnWrapper}:hover & {
    opacity: 1;
  }
`
export const CommunityInfo = styled.div`
  ${css.row('align-start', 'justify-center')};
  margin-top: 5px;
  ${css.fitStickerWidth(METRIC.ARTICLE)};
`
export const Title = styled.div<TArticleTitle>`
  font-size: 22px;
  margin-bottom: 18px;
  max-width: 600px;
  font-weight: 500;
  color: ${({ $isPinned, $color }) => ($isPinned ? rainbow($color) : theme('article.title'))};
  filter: ${({ $isPinned }) => ($isPinned ? 'brightness(1.1)' : '')};

  ${css.media.mobile`
    font-size: 20px;
    margin-bottom: 15px;
  `};
`

export const SubTitle = styled.span`
  display: inline-block;
  color: ${theme('article.digest')};
  opacity: 0.4;
  font-size: 18px;
  margin-left: 10px;
  margin-top: -2px;

  &:before {
    content: '#';
    margin-top: 1px;
    margin-right: 3px;
    font-size: 16px;
  }
`
export const BottomInfo = styled.div`
  ${css.row('align-center', 'justify-between')};
  padding-bottom: 30px;

  width: 100%;
  color: ${theme('article.digest')};
`
export const Avatar = styled(Img)`
  ${css.size(16)};
  border-radius: 4px;
  margin-right: 8px;
`
export const AuthorName = styled(Link)`
  ${css.row('align-center')};
  color: ${theme('article.digest')};
  text-decoration: none;
  font-size: 14px;
  margin-top: 1px;

  &:hover {
    text-decoration: underline;
    color: ${theme('article.digest')};
    cursor: pointer;
  }
`

export const Divider = styled(DotDivider)`
  margin-left: 12px;
  margin-right: 12px;
`
