import type { TBannerLayout } from '~/spec'
import { BANNER_LAYOUT } from '~/const/layout'
import styled, { css, theme } from '~/css'

import { MainWrapper } from '..'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn(''),
  }
}

export const Wrapper = styled.div<{ $bannerLayout?: TBannerLayout }>`
  ${css.column('align-both')};
  width: 100%;
  ${({ $bannerLayout }) =>
    $bannerLayout === BANNER_LAYOUT.TABBER
      ? 'margin-top: 5px;margin-left: 48px;'
      : 'margin-top: 30px;margin-left: 0;'}
`
export const CatsWrapper = styled(MainWrapper)<{ $bannerLayout?: TBannerLayout }>`
  ${css.rowWrap()};
  gap: 30px 30px;
  width: ${({ $bannerLayout }) =>
    $bannerLayout === BANNER_LAYOUT.TABBER ? 'calc(100% + 90px);' : '100%'};
  min-height: 600px;
  padding-right: 0;
  padding-left: 0;

  background: transparent;
  border-right: none;
`

export const Divider = styled.div`
  width: 100%;
  height: 1px;
  margin-left: -5%;
  align-self: flex-start;
  margin-top: 60px;
  margin-bottom: 80px;

  border-bottom: 1px solid transparent;
  border-image: linear-gradient(
    0.35turn,
    transparent,
    ${theme('divider')},
    ${theme('divider')},
    ${theme('divider')},
    transparent
  );

  border-image-slice: 1;
`
