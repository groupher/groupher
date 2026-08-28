import useTwBelt from '~/hooks/useTwBelt'

type TVariant = 'double' | 'masonry' | 'single'

export default function useSalon({
  previewable,
  variant,
}: {
  previewable: boolean
  variant: TVariant
}) {
  const { cn, fg, bg, br, primary } = useTwBelt()

  return {
    image: cn(
      variant === 'masonry' ? 'block h-auto w-full object-contain' : 'size-full object-cover',
    ),
    wrapper: cn(
      'align-both shrink-0 overflow-hidden rounded-sm border transition-colors',
      variant === 'single' && 'size-11',
      variant === 'double' && 'size-16',
      variant === 'masonry' && (previewable ? 'w-full' : 'h-28 w-full'),
      br('divider'),
      !previewable && bg('hoverBg'),
      fg('digest'),
      `hover:${primary('border')}`,
    ),
  }
}
