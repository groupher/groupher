import styled, { css, gradientBg, theme, rainbow } from '~/css'
import type { TColor } from '~/spec'

import CoffeeSVG from '~/icons/CoffeeDuo'
import Img from '~/Img'

export const Wrapper = styled.div`
  ${css.column('align-both')};
  max-width: 1200px;
  height: 100%;
  width: 100%;
  margin-bottom: 80px;
  position: relative;
  overflow: hidden;
`
export const InnerWrapper = styled.div`
  ${css.row('justify-center')};
  width: 100%;
  gap: 0 35px;
`
export const BannerTitle = styled.div`
  font-size: 30px;
  color: ${theme('article.title')};
  margin-top: -20px;
`
export const BannerDesc = styled.div`
  font-size: 18px;
  color: ${theme('article.digest')};
  margin-top: 10px;
  margin-bottom: 60px;
`
type TColumn = TColor & { $opacity?: number }
export const Column = styled.div<TColumn>`
  ${css.column()};
  width: 320px;
  height: 680px;
  padding: 15px 28px;
  border-bottom: 1px solid transparent;
  border: 1px dotted transparent;

  /* border-bottom-color: ${({ $color }) => ($color === 'BLACK' ? theme('divider') : 'transparent')}; */
  /* box-shadow: ${theme('shadow.md')}; */
  border-radius: 28px;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  position: relative;
  overflow: hidden;
  z-index: 1;

  &:hover {
    border-color: ${({ $color }) => rainbow($color)};
  }

  *::selection {
    background-color: ${({ $color }) => rainbow($color)} !important;
    color: white;
  }

  &:after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: ${({ $color }) => gradientBg($color)};
    opacity: ${({ $opacity }) => $opacity || 1};
    transform: ${({ $color }) => ($color === 'ORANGE' ? 'rotate(180deg)' : '')};
    z-index: 0;
  }

  transition: all 0.3s;
`
export const Board = styled.div`
  width: 300px;
  padding: 20px;
  padding-top: 30px;
  position: absolute;
  left: 10px;
  bottom: 75px;
  height: calc(100% - 270px);
  background: ${theme('htmlBg')};
  border-radius: 35px;
  border-bottom-left-radius: 15px;
  border-bottom-right-radius: 15px;
  box-shadow: rgb(235 235 235 / 20%) 0px -5px 8px 0px;
  z-index: 2;
`
type TCatPaw = { top: number; left: number }
export const CatPaw = styled(Img)<TCatPaw>`
  width: 72px;
  z-index: 100000;
  position: absolute;
  left: ${({ left }) => `${left}px`};
  top: ${({ top }) => `${top}px`};
  filter: drop-shadow(2px 4px 6px lightgrey);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2);
`
export const TopTitle = styled.div<TColor>`
  color: ${({ $color }) => rainbow($color)};
  font-size: 15px;
  margin-left: 2px;
  margin-bottom: 10px;
  z-index: 3;
`
export const Desc = styled.div`
  color: ${theme('article.digest')};
  font-size: 15px;
  margin-left: 2px;
  z-index: 3;
`
export const Price = styled.div`
  ${css.row('align-center')};
  color: ${theme('article.title')};
  font-size: 26px;
  font-weight: 600;
  margin-top: 10px;
  margin-bottom: 5px;
  opacity: 0.8;
  z-index: 1;

  &:before {
    content: "¥";
    font-size: 22px;
    opacity: 0.6;
    margin-right: 6px;
    color: ${theme('article.digest')};
  }

  &:after {
    content: "元/月";
    font-size: 16px;
    opacity: 0.8;
    margin-left: 6px;
    margin-top: 4px;
    color: ${theme('article.digest')};
  }
`
export const CoffeeIcon = styled(CoffeeSVG)`
  ${css.size(22)};
  fill: ${theme('rainbow.purple')};
  margin-right: 5px;
  margin-left: 1px;
  opacity: 0.8;
`
export const LetsTalk = styled.div`
  ${css.row('align-center')};
  font-size: 20px;
  z-index: 2;
  color: ${theme('article.title')};
  margin-top: 14px;
  margin-bottom: 10px;
`
type TCancelNote = TColor & { $hide?: boolean }
export const CancelNote = styled.div<TCancelNote>`
  font-size: 13px;
  color: ${({ $color }) => ($color ? rainbow($color) : theme('article.digest'))};
  z-index: 1;
  opacity: 0.8;
  margin-top: ${({ $hide }) => ($hide ? '50px' : 0)};
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2);
`
export const ButtonWrapper = styled.div`
  position: absolute;
  width: 260px;
  bottom: 22px;
  left: 30px;
  z-index: 3;
  opacity: 0.9;
  &:hover {
    opacity: 1;
  }
  transition: opacity 0.2s ease-in-out;
`
