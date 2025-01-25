import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, cut } = useTwBelt()

  return {
    wrapper: cn(''),
    replyBar: cn('row rounded px-2.5 py-1 mx-2.5 mb-2', fg('text.digest'), bg('hoverBg')),
    replyToBody: cn('ml-2.5 mr-5 grow italic', fg('text.title'), cut('w-80')),
    replyToFloor: cn('ml-1', fg('text.hint')),
  }
}
