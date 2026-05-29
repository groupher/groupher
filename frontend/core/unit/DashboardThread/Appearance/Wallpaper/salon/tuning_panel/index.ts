import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg } = useTwBelt()

  return {
    wrapper: cn(
      'w-full rounded-lg border mt-6 overflow-visible transition-[height] duration-200 ease-out',
      br('divider'),
      bg('cardAlpha'),
    ),
    panelContent: 'w-full',
  }
}
