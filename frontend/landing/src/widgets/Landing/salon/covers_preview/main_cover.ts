import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, shadow } = useTwBelt()

  return {
    wrapper: cn('column-center relative rounded-lg', 'w-full min-w-0', shadow('sm')),

    background: cn(
      'absolute h-full w-full top-0 will-change-transform overflow-hidden rounded-lg trans-all-200 dark:brightness-75',
    ),
    content: 'relative w-full align-both rounded-lg z-10',
  }
}
