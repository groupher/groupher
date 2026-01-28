import type { ReactNode } from 'react'
import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {
  width: string
  desc: ReactNode
} & TSpace

export default ({ width, desc, ...spacing }: TProps) => {
  const { cn, fg, margin } = useTwBelt()

  return {
    wrapper: cn('column', width, margin(spacing)),
    header: 'row-center',
    title: cn('row-center w-full text-sm', !desc && 'mb-4', fg('title')),
    desc: cn('text-sm mt-2.5 mb-8 mt-2.5', fg('digest')),
  }
}
