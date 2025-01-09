import styled, { css, theme } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, cutRest } = useTwBelt()

  return {
    wrapper: cn(''),
    replyBar: cn('row rounded px-2.5 py-1 mx-2.5 mb-2', fg('text.digest'), bg('hoverBg')),
    replyToBody: cn('ml-2.5 mr-5 grow italic', fg('text.title'), cutRest('w-80')),
    replyToFloor: cn('ml-1', fg('text.hint')),
  }
}

export const Wrapper = styled.div``

export const ReplyBarBase = styled.div`
  ${css.row()};
  color: ${theme('comment.reply')};
  background: ${theme('comment.replyBg')};
  border-radius: 3px;
  padding: 5px 10px;
  margin-left: 10px;
  margin-right: 10px;
  margin-bottom: 8px;
  border: 1px solid tomato;
`
export const ReplyToBodyBase = styled.div`
  color: ${theme('comment.title')};
  margin-left: 10px;
  margin-right: 20px;
  flex-grow: 1;
  font-style: italic;

  ${css.cutRest('350px')};

  ${css.media.mobile`
    ${css.cutRest('120px')};
  `};
`
export const ReplyToFloorBase = styled.div`
  color: ${theme('comment.floor')};
  margin-right: 5px;
`
