export { cn, cnMerge } from '~/css'

export default function useSalon() {
  return {
    normal: 'relative inline-flex p-0 border-0 bg-transparent',
    fallbackInFlow: 'inline-flex s-full',
    fallbackHidden: 'opacity-0 pointer-events-none',
    imageFrame: 'absolute inset-0 z-10',
    imgOverlay: 'absolute inset-0 z-10 block s-full object-cover',
  }
}
