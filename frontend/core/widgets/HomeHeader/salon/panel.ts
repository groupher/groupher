import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, br, zIndex } = useTwBelt()

  return {
    wrapper: cn(
      'absolute left-0 top-full w-full origin-top overflow-hidden',
      'backdrop-blur-sm border-b',
      'header-panel-shadow',
      bg('cardAlpha'),
      zIndex('header'),
      br('divider'),
    ),
  }
}
