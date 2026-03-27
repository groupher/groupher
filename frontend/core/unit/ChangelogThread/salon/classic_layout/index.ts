import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: 'row w-full',
    main: cn('w-full grow min-h-96 mt-3 pr-16 mr-16 border-r', br('divider')),
  }
}
