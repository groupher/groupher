import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fill, primary } = useTwBelt()

  return {
    wrapper: 'grid grid-cols-4 gap-3 s-full mt-2.5 relative',
    block: cn(
      'w-full h-24 rounded-md overflow-hidden relative border border-2 border-transparent pointer trans-all-200',
      `hover:${br('digest')}`,
    ),
    blockActive: cn(br('digest')),
    image: 'object-cover w-full h-full',
    activeSign: cn(
      'size-5 circle absolute -top-1 -right-0.5 z-20 border',
      primary('bg'),
      br('title'),
    ),
    checkIcon: cn('size-3.5 absolute top-0.5 left-0.5', fill('button.fg')),
    texturePanel: 'column gap-4 w-full min-w-0',
    textureControls: 'column gap-4 w-full min-w-0',
    textureIntensity: 'w-full min-w-0',
  }
}
