import useTwBelt from '~/hooks/useTwBelt'

export default function usePicturesSectionSalon() {
  const { cn, bg, br, primary } = useTwBelt()

  return {
    section: 'column gap-3 w-full',
    pictureGrid: 'grid grid-cols-6 gap-2.5',
    pictureCard: cn(
      'h-16 w-24 rounded-md overflow-hidden relative border border-transparent pointer trans-all-200',
      'p-0.5',
      bg('card'),
      `hover:${br('digest')}`,
    ),
    pictureCardActive: primary('border'),
    pictureImage: 'object-cover w-full h-full rounded-xs',
  }
}
