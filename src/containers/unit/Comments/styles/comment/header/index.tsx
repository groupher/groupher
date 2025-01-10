import styled, { css, theme } from '~/css'

export const Wrapper = styled.div`
  ${css.row('align-center')};
  margin-bottom: 15px;
  margin-left: -38px;
`
export const HeaderBaseInfo = styled.div`
  ${css.column()};
  width: 100%;

  ${css.media.mobile`
    margin-left: 5px;
  `};
`
export const BaseInfo = styled.div`
  ${css.rowGrow('align-center')};
  color: ${theme('comment.username')};
`

export const FloorNum = styled.div`
  color: ${theme('comment.floor')};
  font-size: 13px;
  margin-top: 2px;
  opacity: 0.8;

  transition: opacity 0.25s;
`
export const CreateDate = styled.div`
  ${css.row('align-center')};
  color: ${theme('comment.floor')};
  font-size: 12px;
  margin-left: 2px;
  opacity: 0.8;

  ${css.media.mobile`
    font-size: 10px;
  `};
`
