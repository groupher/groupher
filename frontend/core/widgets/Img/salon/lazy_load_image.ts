export { cn, cnMerge } from '~/css'

export default () => {
  return {
    normal: 'relative inline-flex p-0 border-0 bg-transparent',
    fallbackInFlow: 'inline-flex w-full h-full',
    fallbackHidden: 'opacity-0 pointer-events-none',
    imgOverlay: 'absolute inset-0 z-10 block w-full h-full object-cover',
  }
}
