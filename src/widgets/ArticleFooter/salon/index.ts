import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, br } = useTwBelt()

  return {
    wrapper: cn(
      'column relative border-t border-b',
      'pt-6 pb-3 mt-16 mb-8 min-h-24',
      'border-t border-b-2',
      br('divider'),
      fg('text.digest'),
    ),
    tabs: 'absolute -top-11 -left-2.5',
    content: 'row justify-between',
  }
}
