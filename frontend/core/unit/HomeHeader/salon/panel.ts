import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, br, zIndex } = useTwBelt()

  return {
    wrapper: cn(
      'absolute left-0 top-full w-full h-auto pb-6 pt-4 border-b',
      'header-panel-shadow',
      zIndex('header'),
      br('divider'),
      bg('pageBg'),
    ),
  }
}
