import styled, { css, theme } from '~/css'

import Img from '~/Img'
import LockSVG from '~/icons/Lock'

export { GradientText } from '..'

export const Wrapper = styled.div`
  position: relative;
  width: 1080px;
  border-radius: 12px;
  box-shadow: 0 5px 25px rgb(35 35 35 / 10%);
  margin-top: -251px;
  border-top: 1px solid;
  border-color: ${theme('divider')};

  // for brower header
  padding-top: 38px;
  background: #ffffff6e;
  z-index: 2;

  display: none;

  ${css.media.mobile`
    ${css.column('align-center')};
    width: calc(100% - 20px);
    height: 220px;
    padding-top: 25px;
    border-radius: 7px;
  `};
`
export const BrowerHead = styled.div`
  ${css.row('align-center', 'justify-center')};
  color: ${theme('article.digest')};
  width: 100%;
  position: absolute;
  left: 10px;
  top: 8px;
  padding-left: 8px;

  ${css.media.mobile`
    top: 6px;
  `};
`
export const AddrBar = styled.div`
  ${css.row('align-center')};
  margin-left: -65px;

  ${css.media.mobile`
    margin-left: -35px;
  `};
`
export const LockIcon = styled(LockSVG)`
  ${css.size(12)};
  fill: ${theme('article.digest')};
  opacity: 0.5;
  margin-right: 4px;

  ${css.media.mobile`
    ${css.size(10)};
    margin-top: -1px;
  `};
`
export const AddText = styled.div`
  color: ${theme('article.digest')};
  opacity: 0.7;

  ${css.media.mobile`
    font-size: 10px;
  `};
`
export const Highlight = styled.div`
  color: ${theme('article.title')};

  ${css.media.mobile`
    font-size: 10px;
  `};
`
export const Dot = styled.div`
  ${css.circle(10)};
  background: ${theme('divider')};
  margin-right: 6px;

  ${css.media.mobile`
    display: none;
  `};
`
export const Content = styled.div`
  ${css.row('align-both')};
  width: 100%;
  height: 700px;
  position: relative;
  overflow: hidden;
`
export const Background = styled.div<{ effect: string }>`
  ${css.row('align-both')}
  width: 100%;
  height: 700px;
  background transparent;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  position: absolute;
  top: 0;
  left: 0;

  ${({ effect }) => effect || ''};
  will-change: transform;
  transition: all 0.3s;
`
export const Image = styled(Img)<{ hasShadow: boolean }>`
  display: block;
  width: calc(100% - 60px);
  margin-left: 30px;
  height: 700px;
  object-fit: cover;

  box-shadow: ${({ hasShadow }) =>
    hasShadow ? 'rgb(100 100 111 / 20%) 0px 7px 29px 0px;' : 'none'};

  ${css.media.mobile`
    width: calc(100% - 30px);
    height: 220px;
    margin-left: 15px;
    object-fit: cover;
  `};
  transition: all 0.2s;
`
