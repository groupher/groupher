import type { TColor, TTestable } from '~/spec'

import styled, { css, theme, rainbowSoft } from '~/css'

import { getUserwallGradient, getUserwallGradientOpacity } from '../metric'

export const Wrapper = styled.div.attrs<TTestable>(({ $testid }) => ({
  'data-test-id': $testid,
}))<TTestable>`
  ${css.column('align-both')};
  width: 100%;
  position: relative;
`
export const Slogan = styled.div`
  ${css.column('align-both')};
`
export const Title = styled.div`
  color: ${theme('article.title')};
  font-size: 38px;
  font-weight: 500;

  text-shadow: rgb(0 0 0 / 8%) 0px 10px 20px;
  opacity: 0.9;

  ${css.media.mobile`
    font-size: 22px;
    font-weight: 600;
  `};
`
export const Desc = styled.div`
  font-size: 17px;
  color: ${theme('article.digest')};
  margin-top: 12px;
  opacity: 0.8;

  ${css.media.mobile`
    font-size: 15px;
    text-align: center;
    padding: 0 20px;
    display: inline-block;
    font-weight: 400;
  `};
`
//
export const Wall = styled.div`
  ${css.column('align-both')};
  margin-top: 80px;
  width: 100%;
  height: auto;
  position: relative;

  ${css.media.mobile`
    width: 200%;
    margin-top: 30px;
    padding: 0 20px;
    overflow-x: scroll;
  `};
`
export const WallInner = styled.div`
  width: 220%;
  padding-left: 85%;
  padding-right: 25%;
  display: none;

  ${css.media.mobile`
    display: block;
  `};
`
export const BgGradient = styled.div<{ wallpaper: string }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: ${({ wallpaper }) => `${getUserwallGradientOpacity(wallpaper)}`};

  background: ${({ wallpaper }) =>
    `radial-gradient(circle at 50% 50%, ${getUserwallGradient(wallpaper)[0]} 0, transparent 35%)`};;
`

export const DempP = styled.div`
  line-height: 1.75;
  font-size: 15px;
  p {
    margin-top: 10px;
  }

  ${css.media.mobile`
    font-size: 12px;
    margin-top: 6px;
  `};
`
export const Highlight = styled.span<TColor>`
  color: ${theme('article.digest')};
  font-weight: 450;
  padding: 0 2px;
  background-color: ${({ $color }) => rainbowSoft($color)};
`
