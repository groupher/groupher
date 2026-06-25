import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn(
      'mt-3 w-full border-none bg-transparent p-0 text-lg outline-none disabled:opacity-60',
      fg('digest'),
      'placeholder:text-gray-400',
    ),
  }
}
