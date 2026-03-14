import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, fg, br } = useTwBelt()

  return {
    wrapper: cn(
      'column py-2.5 min-h-72 h-auto border-b-2 trans-all-200',
      bg('sandBox'),
      br('divider'),
    ),
    header: cn('row-center text-base h-8 px-7 pb-2 w-full', fg('digest')),
    editorWrapper: cn('overflow-x-hidden pt-2.5 min-h-80', bg('sandBox')),
    footer: 'pt-4 w-full',
  }
}
