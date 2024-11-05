import type { TActive, TSpace } from '~/spec'
import styled, { css, theme } from '~/css'

import { WithMargin } from '~/widgets/Common'

export const Wrapper = styled.div`
  ${css.column('align-center')};
  color: ${theme('article.digest')};
  width: 100%;
  margin-top: 10px;
`

export const SlideBox = styled.div`
  position: relative;
  ${css.row('align-center', 'justify-around')};
  width: 100%;
  height: 24px;
  border: 1px solid;
  border-color: ${theme('editor.border')};
  border-radius: 20px;
`
type TBar = { $width: string; $colors: string[]; $darker: boolean }
export const Bar = styled.div<TBar>`
  position: absolute;
  left: 0;
  top: -1px;
  border-radius: 15px;
  height: 24px;
  width: ${({ $width }) => $width};
  filter: ${({ $darker }) => ($darker ? 'brightness(0.85)' : 'brightness(1.02)')};
  transition: width 0.25s;
`
/* background: ${({ $colors }) => `linear-gradient(to right, ${$colors[1]}, ${$colors[0]})`}; */

export const BarDot = styled.div`
  ${css.circle(16)};
  background: white;
  position: absolute;
  right: 4px;
  top: 4px;
  box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
`
export const IndexDot = styled.div`
  ${css.circle(6)};
  background-color: ${theme('editor.border')};
  margin-left: -8px;
  cursor: pointer;

  &:hover {
    ${css.circle(8)};
  }

  transition: all 0.2s;
`
export const Footer = styled.div`
  ${css.row('align-center', 'justify-around')};
  width: 100%;
  margin-top: 8px;
`

type TNote = TActive & TSpace
export const Note = styled(WithMargin)<TNote>`
  font-size: 12px;
  color: ${({ $active }) => ($active ? theme('article.title') : theme('lightText'))};
  font-weight: ${({ $active }) => ($active ? 500 : 400)};

  &:hover {
    color: ${theme('article.title')};
    cursor: pointer;
    font-weight: 500;
  }

  transition: color 0.2s;
`
export const ShineNote = styled.div<{ $colors: string[] }>`
  font-size: 12px;
  background: ${({ $colors }) => `linear-gradient(to right, ${$colors[0]}, ${$colors[1]})`};
  font-weight: 550;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 500;
  cursor: pointer;
  margin-left: -22px;
`
