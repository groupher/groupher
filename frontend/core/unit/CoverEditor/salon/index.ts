import { IMAGE_CONTAINER_SIZE } from '../constant'

export default function useSalon() {
  return {
    wrapper: 'group column-align-both w-full mb-8 relative overflow-visible',
    wrapperStyle: {
      maxWidth: IMAGE_CONTAINER_SIZE.WIDTH,
    },
    exportButton:
      'absolute right-2 top-2 z-50 rounded-sm bg-black/65 px-2.5 py-1 text-xs text-white shadow-sm backdrop-blur-sm transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40',
  }
}
