import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: cn(
      'column',
      'py-2.5',
      'bg-transparent',
      'min-h-24',
      'h-auto',
      '-mt-2.5',
      'mb-5',
      'border-b-2',
      br('divider'),
    ),
  }
}
