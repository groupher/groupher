import styled, { css } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('row-center text-xs'),
  }
}

export const Wrapper = styled.div`
  ${css.row('align-center')};
  font-size: 12px;

  ${css.media.mobile`
    font-size: 12px;
  `}
`

export const holder = 1
