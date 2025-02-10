import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  size: number
} & TSpace

export default ({ size, ...spacing }: TProps) => {
  const { cn, margin } = useTwBelt()

  return {
    normal: cn('align-both relative z-10'),
    fallback: 'absolute top-0 left-0 z-0',
    fallbackOffset: cn(`size-[${size}]`, margin(spacing)),
    checkPixel: 'w-px h-px opacity-0 fixed bottom-0 right-0',
  }
}
