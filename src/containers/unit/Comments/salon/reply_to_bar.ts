import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, cutRest } = useTwBelt()

  return {
    replyBar: cn('row rounded py-1 px-2.5 mx-2.5 mb-2', fg('text.digest'), bg('sandBox')),
    replyToBody: cn('ml-2.5 mr-5 grow italic', fg('text.digest'), cutRest('w-80')),
    replyToFloor: cn('mr-1', fg('text.hint')),
  }
}
