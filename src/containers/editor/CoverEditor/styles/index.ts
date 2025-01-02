import type { TTestable } from '~/spec'
import styled, { css } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('group column-align-both mb-8 relative pb-7 ml-7'),
  }
}

export const Wrapper = styled.div.attrs<TTestable>(({ $testid }) => ({
  'data-test-id': $testid,
}))<TTestable>`
  ${css.column('align-both')};
  margin-bottom: 30px;
  position: relative;
  padding-bottom: 30px;
  margin-left: 30px;
`
export const holder = 1
