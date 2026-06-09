export { cn } from '~/css'

export default function useSalon() {
  return {
    wrapper: 'overflow-hidden',
    wrapperPositioned: 'relative',
    layer: 'absolute inset-0 transition-opacity duration-200 ease-out',
    layerFadeIn: 'opacity-100',
    layerFadeOut: 'opacity-0',
    fallback: 'absolute inset-0 bg-center',
    canvas: 'absolute inset-0 block size-full',
    pattern: 'absolute inset-0 pointer-events-none',
  }
}
