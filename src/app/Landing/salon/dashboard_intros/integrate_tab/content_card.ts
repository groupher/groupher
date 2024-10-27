import styled, { css, theme } from '~/css'

export const Wrapper = styled.div`
  ${css.column()};
  padding: 20px;
  background: ${theme('htmlBg')};
  color: ${theme('article.digest')};
  border: 1px solid;
  border-color: ${theme('divider')};
  width: 420px;
  height: 460px;
  border-radius: 15px;
  box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
  z-index: 2;
  position: absolute;
  bottom: 160px;
  left: 140px;
`
export const holder = 1
