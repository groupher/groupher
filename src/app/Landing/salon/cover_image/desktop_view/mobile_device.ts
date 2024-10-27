import styled, { css, theme } from '~/css'

import Img from '~/Img'

export const Wrapper = styled.div`
  ${css.column('align-center')};
  position: absolute;
  bottom: -5px;
  right: 45px;
  width: 194px;
  border-radius: 12px;
  box-shadow: rgba(0, 0, 0, 0.1) 0px 10px 50px;
  border: 1px solid;
  border-color: ${theme('divider')};

  // for brower header
  padding-top: 16px;
  background: white;
  transform: rotate(6deg);

  z-index: 3;
`
export const Bar = styled.div`
  height: 3px;
  width: 28px;
  border-radius: 3px;
  background: ${theme('article.digest')};

  position: absolute;
  top: 8px;
  left: 82px;
  opacity: 0.5;
`
export const Content = styled.div`
  ${css.row('align-both')};
  width: 100%;
  height: 360px;
  position: relative;
  overflow: hidden;
`
export const Background = styled.div<{ effect: string }>`
  ${css.row('align-both')}
  width: 100%;
  height: 100%;
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
export const Image = styled(Img)`
  display: block;
  width: 180px;
  height: auto;
  object-fit: cover;
  margin-top: 20px;
`
