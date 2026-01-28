import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fill, menu, hover } = useTwBelt()

  return {
    wrapper: cn('row-center'),
    title: cn('row-center text-sm', hover('fg')),
    panel: cn('w-32 py-1.5 px-1', menu('bg')),
    menuIcon: cn('', menu('icon')),
    menuItem: cn('text-sm', menu('bar')),
    menuTitle: cn('text.sm', menu('title')),
    //
    arrowIcon: cn('size-3 rotate-90', fill('digest')),
  }
}
