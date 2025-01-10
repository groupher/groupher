import styled, { theme } from '~/css'
// import styled, { css } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('relative ml-1.5'),
  }
}

type TIndentLine = {
  isFold: boolean
  hasReplies: boolean
}

export const IndentLine = styled.div<TIndentLine>`
  position: absolute;
  top: ${({ isFold }) => (isFold ? '62px' : '78px')};
  left: 2px;
  height: ${({ isFold }) => (isFold ? 'calc(100% - 62px)' : 'calc(100% - 85px)')};
  width: 20px;
  margin-left: 5px;

  border-left: 1px solid transparent;
  border-image: linear-gradient(
    0.28turn,
    ${theme('comment.indentLine')},
    ${theme('comment.indentLine')},
    ${theme('comment.indentLine')},
    ${theme('comment.indentLine')},
    transparent
  );

  border-image-slice: 1;

  &:hover {
    cursor: pointer;

    border-left: 1px solid transparent;
    border-image: linear-gradient(
      0.28turn,
      ${theme('comment.indentActive')},
      ${theme('comment.indentActive')},
      ${theme('comment.indentActive')},
      ${theme('comment.indentActive')},
      transparent
    );
    border-image-slice: 1;
  }

  transition: all 0.2s;
`
