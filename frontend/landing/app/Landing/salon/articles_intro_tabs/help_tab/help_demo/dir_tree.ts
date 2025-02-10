import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, fill, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'mt-10 w-44 h-auto mb-6 p-4 rounded-md border',
      bg('htmlBg'),
      br('divider'),
      shadow('sm'),
    ),
    pinnedItem: 'row-center mb-0.5',
    icon: cn('size-3 mr-1 -mt-1', fill('text.digest')),
    file: cn('text-xs mb-2 ml-1', fg('text.digest')),
    dir: cn('text-xs bold-sm mb-2', fg('text.title')),
  }
}
