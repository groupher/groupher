import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, menu, rainbow, fill, rainbowSoft, sexyHBorder, primary } = useTwBelt()

  return {
    wrapper: cn('mr-0.5'),
    item: cn(menu('bar'), 'row-center group'),
    title: cn(menu('title'), 'grow ml-0.5 text-sm'),
    titleActive: fg('text.title'),
    divider: sexyHBorder(),
    checkIcon: cn('size-4', primary('fill')),
    icon: cn('size-3.5 mr-2', fill('text.digest')),
    rainbow,
    rainbowSoft,
  }
}
