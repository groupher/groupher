import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn(
      'column py-2.5 min-h-72 h-auto border-b-2 trans-all-200',
      bg('sandBox'),
      br('divider'),
    ),
    header: cn('text-base column h-16 px-7 pb-2 w-full', fg('text.digest')),
    //
    replyToHint: 'row-center mb-1.5',
    replyToContent: cn('line-clamp-1 text-sm', fg('text.title')),
    replyToAuthor: cn('ml-1.5', fg('text.title')),
    editorWrapper: cn('overflow-x-hidden pt-2.5 min-h-80', bg('sandBox')),
    footer: 'w-full pt-4',
  }
}
