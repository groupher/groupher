import useTwBelt from '~/hooks/useTwBelt'

import { getImagePlacement, getImageSize, getResponsiveImageSize } from '../../salon/metric'

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
    imageFrameActive: 'transition-none',
    cropViewport: 'relative size-full overflow-hidden trans-all-200',
    image: 'block size-full trans-all-200 object-cover pointer-events-none select-none',
    borderHighlight: 'absolute inset-0 z-20 pointer-events-none overflow-visible',
    light:
      'absolute -translate-x-1/2 -translate-y-1/2 trans-all-200 bg-blend-lighten pointer-events-none z-30',
    editorFrame:
      'absolute z-40 touch-none select-none cursor-move opacity-0 transition-opacity duration-150 hover:opacity-100',
    editorFrameActive: 'opacity-100 transition-none cursor-grabbing',
    editorFrameResizing: 'cursor-crosshair',
    editorBorder:
      'absolute inset-0 pointer-events-none border border-sky-500 shadow-[0_0_0_1px_rgba(14,165,233,0.25)]',
    resizeHandle:
      'absolute z-10 size-3 rounded-full border-2 border-sky-500 bg-white shadow-sm pointer-events-auto',
    resizeHandleTopLeft: '-left-1.5 -top-1.5 cursor-nwse-resize',
    resizeHandleTopRight: '-right-1.5 -top-1.5 cursor-nesw-resize',
    resizeHandleBottomLeft: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
    resizeHandleBottomRight: '-bottom-1.5 -right-1.5 cursor-nwse-resize',

    // helpers
    cn,
    getImageSize,
    getResponsiveImageSize,
    getImagePlacement,
  }
}
