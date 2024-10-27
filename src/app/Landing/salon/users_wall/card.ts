import type { TColorName } from '~/spec'

import styled, { css, theme, rainbowSoft } from '~/css'
import Img from '~/Img'

export const Wrapper = styled.div`
  color: ${theme('article.digest')};
  width: 300px;
  /* height: 300px; */
  height: auto;
  border-radius: 10px;
  font-size: 16px;
  background: #ffffffd4;
  padding: 20px;
  box-shadow: 0 5px 25px rgb(35 35 35 / 10%);
  margin-bottom: 25px;

  ${css.media.mobile`
    width: 100%;
    margin-bottom: 10px;
    padding: 10px;
  `};
`

export const Header = styled.div`
  ${css.row('align-center')};
  margin-bottom: 10px;
`

export const Avatar = styled(Img)<{ color: TColorName }>`
  ${css.circle(30)};
  border: 2px solid;
  padding: 2px;
  border-color: ${({ color }) => rainbowSoft(color)};
  background-color: ${({ color }) => rainbowSoft(color)};

  ${css.media.mobile`
    ${css.circle(25)};
  `};
`

export const User = styled.div``

export const Nickname = styled.div`
  color: ${theme('article.title')};
  margin-left: 10px;
  font-size: 14px;

  ${css.media.mobile`
    font-size: 12px;
  `};
`

export const Content = styled.div``
