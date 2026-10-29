import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column-center relative w-full z-20'),
    mobileRail: 'cover-scene-mobile-rail hidden',
    gallery: 'cover-scene-gallery relative mt-16',
  }
}
