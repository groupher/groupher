import type { TSpace } from '~/spec'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  //
} & TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, primary, fg, vividDark } = useTwBelt()

  return {
    wrapper: cn('row-center group-smoky-65', margin(spacing)),
    checkIcon: cn('size-3.5 hidden opacity-0 mr-2 trans-all-100', primary('fill')),
    checkIconActive: cn('size-3.5 block opacity-100 max-w-auto', primary('fill'), vividDark()),
    title: cn('font-sm', fg('text.digest')),
    titleActive: cn(fg('text.title')),
  }
}
