import type { TTestable } from '~/spec'
import styled, { css, theme } from '~/css'

export const Wrapper = styled.div.attrs<TTestable>(({ $testid }) => ({
  'data-test-id': $testid,
}))<TTestable>`
  ${css.column()};
  position: relative;
  border-top: 1px solid;
  border-bottom: 2px solid;
  border-color: ${theme('divider')};
  padding: 26px 0;
  padding-bottom: 12px;
  margin-top: 68px;
  margin-bottom: 32px;
  min-height: 100px;
  color: ${theme('article.digest')};

  ${css.media.mobile`
    margin-top: 55px;
    margin-bottom: 0;
    padding: 20px 0;
    padding-bottom: 8px;
  `};
`
export const TabsWrapper = styled.div`
  position: absolute;
  top: -44px;
  left: -10px;

  ${css.media.mobile`
    left: -20px;
    top: -32px;
    transform: scale(0.8);
  `};
`
export const ContentWrapper = styled.div`
  ${css.row('justify-between')};
`
