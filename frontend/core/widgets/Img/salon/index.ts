export { cn, cnMerge } from '~/css'

export default () => {
  return {
    wrapper: 'relative z-10 inline-block p-0 border-0 bg-transparent align-middle shrink-0',
    notLoaded: '-z-10 opacity-0 absolute',
    img: 'absolute inset-0 z-0 block s-full object-cover',
    fallbackOverlay: 'grid place-items-center absolute inset-0 z-10',
  }
}
