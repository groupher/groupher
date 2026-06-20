export { cn } from '~/css'

export default function useSalon() {
  return {
    wrapper: 'overflow-hidden',
    wrapperPositioned: 'relative',
    layer: 'abs-full transition-opacity duration-200 ease-out',
    layerFadeIn: 'opacity-100',
    layerFadeOut: 'opacity-0',
    fallback: 'abs-full bg-center',
    canvas: 'abs-full block size-full',
    pattern: 'abs-full-pe-none',
  }
}
