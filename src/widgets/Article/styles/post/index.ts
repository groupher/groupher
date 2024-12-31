import type { TTestable, TMetric } from '~/spec'
import styled, { css } from '~/css'

type TWrapper = { metric: TMetric } & TTestable
export const Wrapper = styled.nav.attrs<TWrapper>(({ $testid }) => ({
  'data-test-id': $testid,
}))<TWrapper>`
  ${css.column('align-center')};
  position: relative;
  background: transparent;
  min-height: 248px;
  height: auto;
  margin-bottom: 24px;
  width: 100%;
  ${({ metric }) => css.fitPageWidth(metric)};
`
export const HeaderWrapper = styled.div`
  margin-left: -16px;
`
export const InnerWrapper = styled.div<{ metric: TMetric }>`
  width: 100%;
  ${({ metric }) => css.fitContentWidth(metric)};
`
export const BannerContent = styled.div`
  ${css.row('justify-start')};
`
export const Main = styled.div`
  padding-right: 30px;
  flex-grow: 1;
`
