import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: 'row-center justify-between pr-1.5',
    appearanceButton: cn(
      'plain-button group align-both size-10 shrink-0 rounded-md outline-none',
      'focus-visible:ring-1 focus-visible:ring-current',
    ),
    appearancePreview: cn(
      'align-both size-6 shrink-0 rounded-full',
      'transition-transform duration-150 group-hover:scale-105 group-active:scale-[0.96]',
    ),
    appearancePreviewDot: 'size-2.5 rounded-full',
  }
}
