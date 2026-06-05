import { pixelAdd } from '~/dom'
import useTwBelt from '~/hooks/useTwBelt'

import { getImagePlacement, getImageSize, getResponsiveImageSize } from '../metric'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('w-full aspect-[71/40] rounded relative overflow-hidden'),
    wrapperStyle: {},
    transparentGridStyle: {
      backgroundColor: 'rgba(255, 252, 247, 0.9)',
      backgroundImage: `
        linear-gradient(45deg, rgba(110, 103, 92, 0.11) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(110, 103, 92, 0.11) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(110, 103, 92, 0.11) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(110, 103, 92, 0.11) 75%)
      `,
      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
      backgroundSize: '16px 16px',
    },
    imageFrame: 'absolute trans-all-200',
    cropViewport: 'relative size-full overflow-hidden trans-all-200',
    image: 'block size-full trans-all-200 object-cover',
    borderHighlight: 'absolute inset-0 z-20 pointer-events-none overflow-visible',
    light:
      'absolute size-96 -translate-x-1/2 -translate-y-1/2 trans-all-200 bg-blend-lighten pointer-events-none z-30',

    // helpers
    pixelAdd,
    getImageSize,
    getResponsiveImageSize,
    getImagePlacement,
  }
}
