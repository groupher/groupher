import styled, { css, theme } from '~/css'

import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fill, hoverable, avatar, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-center relative py-2 px-1 -ml-2', hoverable('bg')),
    expandIcon: cn('size-3.5 mr-3.5', fill('text.digest')),
    avatar: cn('size-4 mr-2.5', avatar()),
    createDate: cn(
      'row-center justify-end text-xs ml-0.5 min-w-10 mr-1 break-keep',
      fg('text.hint'),
    ),
    commentBody: cn('text-sm grow line-clamp-1', fg('text.digest')),
    repliesHint: cn('text-xs mr-1.5', fg('link')),
    solutionIcon: cn('size-3.5 ml-px mt-0.5', rainbow(COLOR_NAME.GREEN, 'fill')),
  }
}

export const CurveLine = styled.div`
  position: absolute;
  left: -38px;
  top: -15px;
  ${css.size(45)};
  border-radius: 22px;
  border-bottom: 1px solid;
  border-bottom-color: ${theme('comment.indentLine')};
  transform: rotate(20deg);
  z-index: -1;

  &:after {
    content: '';
    ${css.circle(26)};
    background: ${theme('alphaBg2')};
    position: absolute;
    bottom: -5px;
    right: -1px;
  }
`
