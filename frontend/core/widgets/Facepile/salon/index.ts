import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = { total: number } & TSpace

export default ({ total, ...spacing }: TProps) => {
  const { cn, margin, br } = useTwBelt()

  return {
    wrapper: cn('row-center flex-row-reverse list-none m-auto', margin(spacing)),
    avatars: 'row-center',
    totalOneOffset: 'mr-2.5',
    avatarFallback: cn('border', br('divider')),
  }
}
