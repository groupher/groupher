import type { ReactNode } from 'react'

import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cnMerge } from '~/css'

type TProps = {
  width: string
  desc: ReactNode
} & TSpace

export default function useSalon({ width, desc, ...spacing }: TProps) {
  const { cn, fg, margin, primary } = useTwBelt()

  return {
    wrapper: cn('column', width, margin(spacing)),
    header: 'row-center w-full',
    title: cn('row-center w-full text-base', !desc && 'mb-4', fg('title')),
    touchedMark: cn(
      'ml-2 size-1.5 shrink-0 origin-left rounded-full animate-section-label-touched-in',
      primary('bg'),
    ),
    desc: cn('text-sm mt-2.5 mb-8 mt-2.5 leading-relaxed', fg('digest')),
  }
}
