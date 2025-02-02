import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, primary } = useTwBelt()

  return {
    wrapper: 'column w-full mt-2.5',
    menuItem: cn(
      'row-center w-40 h-8 no-underline pl-1 mb-0.5 rounded-lg pointer',
      `hover:${bg('hoverBg')}`,
    ),
    menuTitle: cn('text-sm ml-2.5', fg('text.digest')),
    titleActive: cn('bold', primary('fg')),
  }
}
