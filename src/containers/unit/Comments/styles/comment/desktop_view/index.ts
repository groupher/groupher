import Img from '~/Img'
import styled, { css, theme, animate } from '~/css'

import UserBadge from '~/icons/UserBadge'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('row relative bg-transparent pt-5'),
    pinState: 'row-center absolute top-0 left-0 ml-px',
    pinIcon: cn('size-3.5 -rotate-12', fill('text.digest')),
    pinText: cn('text-xs ml-4', fg('text.digest')),
    comment: 'group row grow w-full',
    sidebar: cn('column h-full min-w-8', fg('text.title')),
    commentBody: 'column w-full',
  }
}
export const CommentWrapper = styled.div`
  ${css.rowGrow()};
  width: 100%;
`
export const SidebarWrapper = styled.div`
  color: ${theme('article.title')};
  ${css.column('align-start')};
  height: 100%;
  min-width: 33px;
`
export const BadgePopContent = styled.div`
  padding: 5px 10px;
  font-size: 12px;
`
export const AuthorUpvotedIcon = styled(UserBadge)`
  ${css.size(14)};
  fill: ${theme('comment.icon')};
  opacity: 0.8;
  margin-top: 4px;
  margin-left: 1px;
  animation: ${animate.zoomIn} 0.2s linear;
`
export const SolutionIcon = styled(Img)<{ isAuthorUpvoted: boolean }>`
  ${css.size(14)};
  fill: ${theme('rainbow.green')};
  margin-top: ${({ isAuthorUpvoted }) => (isAuthorUpvoted ? '7px' : '3px')};
  margin-left: 1px;
`
export const IndentLine = styled.div`
  flex-grow: 1;
  width: 20px;
  height: 100%;

  border-left: 1px solid transparent;
  border-image: linear-gradient(
    0.36turn,
    ${theme('comment.indentLine')},
    ${theme('comment.indentLine')},
    ${theme('comment.indentLine')},
    transparent
  );

  border-image-slice: 1;

  margin-left: 7px;
  margin-top: 50px;

  ${SidebarWrapper}:hover & {
    cursor: pointer;
    border-left: 1px solid transparent;
    border-image: linear-gradient(
      0.36turn,
      ${theme('comment.indentActive')},
      ${theme('comment.indentActive')},
      ${theme('comment.indentActive')},
      ${theme('comment.indentActive')},
      transparent
    );
    border-image-slice: 1;
  }

  ${CommentWrapper}:hover & {
    opacity: 1;
  }

  transition: all 0.2s;
`
