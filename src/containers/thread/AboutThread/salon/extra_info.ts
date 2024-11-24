import styled, { css, theme } from '~/css'

export const Wrapper = styled.div`
  ${css.rowWrap()};
  height: auto;
  width: 600px;
  padding-top: 10px;
  padding-bottom: 0;
  margin-top: 20px;

  ${css.media.mobile`
    display: none;
  `};
`

export const MobileWrapper = styled.div`
  display: none;

  ${css.media.mobile`
    display: block;
    padding: 0 20px;
  `};
`

export const Block = styled.div<{ hide?: boolean }>`
  display: ${({ hide }) => (hide ? 'none' : 'block')};

  margin-bottom: 20px;
  width: 50%;
`

export const Title = styled.div`
  font-size: 14px;
  color: ${theme('article.digest')};
  font-weight: 500;
  margin-bottom: 10px;
`
