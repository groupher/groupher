export { cnMerge } from '~/css'

export default function useSalon() {
  return {
    wrapper: 'relative z-10 inline-block p-0 border-0 bg-transparent align-middle shrink-0',
    notLoaded: '-z-10 opacity-0 absolute',
    img: 'abs-full z-0 block s-full object-cover',
    fallbackOverlay: 'grid place-items-center abs-full z-10',
  }
}
