import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn(
      'column py-2.5 min-h-72 h-auto border-b-2 trans-all-200',
      bg('sandBox'),
      br('divider'),
    ),
    header: cn('text-base column h-16 px-7 pb-2 w-full', fg('digest')),
    //
    replyToHint: 'row-center mb-1.5',
    replyToContent: cn('line-clamp-1 text-sm', fg('title')),
    replyToAuthor: cn('ml-1.5', fg('title')),
    editorWrapper: cn('overflow-x-hidden pt-2.5 min-h-80', bg('sandBox')),
    footer: 'w-full pt-4',
  }
}
