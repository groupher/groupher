import { IMAGE_CONTAINER_SIZE } from '../constant'

export default function useSalon() {
  return {
    wrapper: 'group column-align-both w-full mb-8 relative overflow-visible',
    wrapperStyle: {
      maxWidth: IMAGE_CONTAINER_SIZE.WIDTH,
    },
  }
}
