import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, bg, shadow } = useTwBelt()

  return {
    wrapper: cn('relative inline-flex h-8.5 max-w-full items-center rounded-lg p-1', bg('hoverBg')),
    indicator: cn(
      'pointer-events-none absolute top-1 left-0 z-0 h-6 rounded-md transition-[transform,width,opacity] duration-200 ease-out will-change-[transform,width]',
      bg('card'),
      shadow('sm'),
    ),
  }
}
