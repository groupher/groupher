import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, br, fill } = useTwBelt()

  return {
    wrapper: cn('w-full h-14 ml-1 pb-4 border-b', br('divider')),
    main: 'row-center w-full',
    inputWrapper: 'relative w-44 min-w-44 mr-9 h-7',
    input: 'pl-7 h-7',
    icon: cn('size-3 z-20 mr-1', fill('text.digest')),
    dateRange: 'text-sm',
  }
}
