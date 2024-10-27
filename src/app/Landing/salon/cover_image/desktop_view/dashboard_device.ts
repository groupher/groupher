import styled, { css, theme } from '~/css'

import Img from '~/Img'

export const Wrapper = styled.div`
  ${css.column('align-center')};
  position: absolute;
  bottom: 15px;
  left: -20px;

  width: 360px;
  border-radius: 12px;
  box-shadow: 0 5px 25px rgb(35 35 35 / 10%);
  border: 1px solid;
  border-color: ${theme('divider')};

  // for brower header
  padding-top: 10px;
  background: white;
  transform: rotate(-5deg);

  margin-left: 15px;

  z-index: 3;
`
export const Content = styled.div`
  ${css.row('align-both')};
  width: 100%;
  height: 240px;
  position: relative;
  overflow: hidden;
`

export const Image = styled(Img)`
  display: block;
  width: 100%;
  height: 240px;
  object-fit: cover;
`
