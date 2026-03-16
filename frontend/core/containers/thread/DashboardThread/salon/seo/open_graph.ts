import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'pb-8 mb-5',
    label: cn('font-sm', fg('title')),
    input: 'mt-2.5 mb-5 w-full',
    enableDesc: 'w-full leading-relaxed',
  }
}
