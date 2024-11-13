import Link from 'next/link'

import styled, { css, theme } from '~/css'
import Img from '~/Img'

export const Wrapper = styled.div`
  ${css.row()};
`
export const CardWrapper = styled.div`
  position: absolute;
  border-radius: 4px;
  width: 150px;
  height: 68px;
  border: 1px solid;
  border-color: ${theme('divider')};
  z-index: 1000;
  top: 6.5px;
`
export const CommunityWrapper = styled.div`
  ${css.row('align-both')};
  width: 100%;
  height: 100%;
`
export const CommunityLogo = styled(Img)`
  ${css.size(32)};
  margin-right: 10px;
`
export const CommunityInfo = styled.div`
  ${css.column()};
  margin-top: -2px;
`
export const LogoText = styled(Link)`
  color: ${theme('article.digest')};
  font-size: 0.8rem;
  font-family: Cursive, Helvetica;
  display: block;

  &:hover {
    text-decoration: none;
    color: ${theme('article.title')};
  }
`

export const CommunityTitle = styled.div`
  color: ${theme('article.title')};
  font-size: 1rem;
  font-weight: bold;
  margin-top: -2px;

  ${css.cutRest('90px')};
`
export const Breadcrumbs = styled.div`
  ${css.row('align-center')};
  max-width: 650px;
  margin-left: 160px;
  height: 100%;
`

export const LogoHolder = styled(Img)`
  fill: ${theme('article.digest')};
  ${css.size(40)};
  opacity: 0.6;
`
