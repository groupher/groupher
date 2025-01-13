import styled, { css, theme } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column items-center w-full h-[480px]'),
    scroll: 'relative w-full h-[480px] overflow-y-scroll',
    title: cn('text-sm', fg('text.title')),
  }
}

export const Wrapper = styled.div`
  ${css.column('align-center')};
  width: 100%;
  height: 480px;
`
export const ScrollWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 480px;
  overflow-y: scroll;
`
export const Title = styled.div`
  color: ${theme('article.title')};
  font-size: 13px;
`
