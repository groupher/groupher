import styled, { css, theme } from '~/css'
import { MarkdownStyles } from '~/widgets/Common'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center w-11/12 p-2.5', fg('text.digest')),
    inner: 'w-96 mt-5',
  }
}

export const Wrapper = styled(MarkdownStyles)`
  ${css.row('justify-center')};
  width: 85%;
  padding: 10px;
  color: ${theme('article.digest')};
`
export const InnerWrapper = styled.div`
  width: 360px;
  margin-top: 20px;
`

export const ItemsWrapper = styled.div`
  ${css.column()};
`
