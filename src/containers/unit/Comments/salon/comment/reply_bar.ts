import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, fill, avatar } = useTwBelt()

  return {
    wrapper: cn(
      'row-center rounded-md px-2 py-1.5 mr-2 mb-2 max-w-[580px] -ml-0.5',
      fg('text.digest'),
      bg('sandBox'),
    ),
    avatar: cn('size-3.5 circle ml-1.5 mr-1.5', avatar()),
    replyToBody: cn('ml-2.5 mr-5 grow italic', fg('text.title')),
    replyToFloor: cn('mr-1.5', fg('text.hint')),
    replyIcon: cn('size-3.5 mr-1 mt-0.5', fill('text.hint')),
  }
}
