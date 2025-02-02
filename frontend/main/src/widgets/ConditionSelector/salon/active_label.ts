import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: 'row-center',
    label: cn('row-center h-6 px-2 py-1 rounded-lg border', br('divider'), bg('menuHoverBg')),
    stateTitle: cn('text-xs -ml-1', fg('text.title')),
    //
  }
}
