import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: cn(
      'column-center rounded-lg',
      'w-full min-w-0',
      'cover-scene-device absolute inset-0 overflow-hidden',
    ),

    background: cn('absolute h-full w-full top-0 overflow-hidden rounded-lg dark:brightness-75'),
    content: 'cover-scene-content relative z-10 flex w-full items-end justify-center rounded-lg',
    stage: 'cover-scene-stage relative w-9/10 overflow-hidden',
    productImage: 'cover-scene-product-image absolute block h-auto max-w-none',
  }
}
