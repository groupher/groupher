import styled, { css } from '~/css'

export const Wrapper = styled.div`
  ${css.row('justify-center')};
  position: relative;
  min-height: 250px;
  width: 100%;

  ${css.media.mobile`
    padding: 0 20px;
    margin-left: 0;
  `};
`
export const InnerWrapper = styled.div`
  width: 100%;
`
export const ArticleWrapper = styled.div`
  font-size: 15px;
  min-height: 200px;
  max-width: 580px;
`
export const BodyHeaderWrapper = styled.div`
  margin-top: -18px;
  margin-bottom: 18px;
`
export const CommentsWrapper = styled.div`
  margin-top: 35px;
`
