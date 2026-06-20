import useTwBelt from '~/hooks/useTwBelt'

import { getImagePlacement, getImageSize, getResponsiveImageSize } from '../../salon/metric'

export default function useSalon() {
  const { cn, primary, accent } = useTwBelt()

  return {
    wrapper: 'group/cover-canvas w-full rounded relative overflow-visible',
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
    contentLayer: 'absolute inset-0 rounded overflow-hidden',
    editorClipLayer: 'absolute inset-0 rounded overflow-hidden',
    backgroundLayer: 'absolute inset-0',
    imageFrame: 'absolute trans-all-200',
    imageFrameActive: '!transition-none',
    cropViewport: 'relative size-full overflow-hidden trans-all-200',
    cropViewportActive: '!transition-none',
    image: 'block size-full trans-all-200 object-cover pointer-events-none select-none',
    imageActive: '!transition-none',
    borderHighlight: 'absolute inset-0 z-20 pointer-events-none overflow-visible',
    magnifier:
      'absolute z-50 aspect-square -translate-x-1/2 -translate-y-1/2 touch-none select-none cursor-move rounded-full trans-all-200',
    magnifierMoving: '!transition-none cursor-grabbing',
    magnifierResizing: '!transition-none cursor-crosshair',
    magnifierZooming: '!transition-none cursor-ew-resize',
    magnifierViewport:
      'relative size-full overflow-hidden rounded-full bg-white/[0.01] shadow-[var(--magnifier-shadow)] before:absolute before:inset-0 before:z-10 before:rounded-full before:pointer-events-none before:bg-[image:var(--magnifier-rim)] before:shadow-[var(--magnifier-edge-shadow)] after:absolute after:inset-0 after:z-10 after:rounded-full after:pointer-events-none after:bg-[image:var(--magnifier-crescent)] after:blur-[1.5px] after:[mask-image:var(--magnifier-crescent-mask)] after:[-webkit-mask-image:var(--magnifier-crescent-mask)]',
    magnifierClone: 'absolute overflow-hidden pointer-events-none',
    magnifierRadiusHandle: cn(
      'absolute left-[75%] top-[6.7%] z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_2px_7px_rgba(0,0,0,0.28)] cursor-nesw-resize outline-none pointer-events-auto',
      primary('bg'),
      `focus-visible:${primary('border')}`,
    ),
    magnifierZoomHandle: cn(
      'absolute left-[85.35%] top-[85.35%] z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_2px_7px_rgba(0,0,0,0.28)] cursor-nwse-resize outline-none pointer-events-auto',
      accent('bg'),
      `focus-visible:${accent('border')}`,
    ),
    editorFrame:
      'group/image-editor absolute z-40 touch-none select-none opacity-0 transition-opacity duration-150 hover:opacity-100',
    editorFrameHidden: '!opacity-0',
    editorFrameActive: 'opacity-100 !transition-none',
    editorFrameMove: 'cursor-move',
    editorFrameMoving: 'cursor-grabbing',
    editorFrameCropping: 'cursor-grab',
    editorFrameCroppingActive: 'cursor-grabbing',
    editorFrameResizing: 'cursor-crosshair',
    editorBorder:
      'absolute inset-0 pointer-events-none border border-current shadow-[0_0_0_1px_currentColor] opacity-80',
    editorBorderTone: primary('fg'),
    resizeHandleGroup: 'absolute z-10 size-24 cursor-default pointer-events-auto',
    resizeHandle: cn(
      'absolute left-1/2 top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white shadow-sm pointer-events-auto',
      primary('border'),
    ),
    resizeHandleTopLeft: '-left-12 -top-12',
    resizeHandleTopRight: '-right-12 -top-12',
    resizeHandleBottomLeft: '-bottom-12 -left-12',
    resizeHandleBottomRight: '-bottom-12 -right-12',
    resizeCursorNwse: 'cursor-nwse-resize',
    resizeCursorNesw: 'cursor-nesw-resize',
    radiusBridge: 'absolute left-1/2 top-1/2 z-0 h-9 w-9 pointer-events-none',
    radiusGuide:
      'absolute left-1/2 top-1/2 z-0 w-9 border-t-2 border-dashed border-current pointer-events-none',
    radiusGuideTone: accent('fg'),
    radiusDot: cn(
      'absolute left-1/2 top-1/2 z-20 size-2.5 rounded-full border border-white shadow-sm pointer-events-auto cursor-default',
      accent('bg'),
    ),

    // helpers
    cn,
    getImageSize,
    getResponsiveImageSize,
    getImagePlacement,
  }
}
