import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fill } = useTwBelt()

  return {
    wrapper: cn('w-full h-fit ml-1 pb-4 border-b', br('divider')),
    main: 'row-center gap-x-4 w-full',
    inputWrapper: 'relative  h-7',
    input: 'pl-7 h-7',
    icon: cn('size-3 z-20 mr-1', fill('digest')),
    dateRange: 'text-sm',
  }
}
