import styled, { css, theme } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column w-52 min-w-52 pt-6'),
    desc: cn('text-base mb-6', fg('text.digest')),
    tabs: 'row-center mb-6 -ml-2.5',
  }
}

export const Desc = styled.div`
  color: ${theme('article.digest')};
  font-size: 14px;
  margin-bottom: 25px;
`
export const TabWrapper = styled.div`
  ${css.row('align-center')};
  position: relative;
  margin-bottom: 25px;
  margin-left: -10px;

  &:before {
    content: '';
    height: 1px;
    width: 180px;
    position: absolute;
    left: 13px;
    bottom: 0;
    background: lightgrey;
    opacity: 0.5;
  }
`
