import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, fill, menu, primary } = useTwBelt()

  return {
    wrapper: 'mr-1',
    icon: cn('size-3.5 mr-2', fill('text.digest'), `group-hover:${fill('text.title')}`),
    item: cn('row-center w-full -ml-1', menu('bar')),
    itemActive: bg('hoverBg'),
    title: cn('text-sm', menu('title')),
    titleActive: fg('text.title'),
    checkIcon: cn('size-3.5', primary('fill')),
  }
}
