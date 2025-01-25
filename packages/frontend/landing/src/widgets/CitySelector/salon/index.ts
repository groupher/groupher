import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

import USSVG from '~/icons/nation/US'
import AUSVG from '~/icons/nation/AU'
import DESVG from '~/icons/nation/DE'
import JPSVG from '~/icons/nation/JP'
import ENSVG from '~/icons/nation/EN'
import CASVG from '~/icons/nation/CA'
import THSVG from '~/icons/nation/TH'
import SGSVG from '~/icons/nation/SG'

export { cn } from '~/css'

type TProps = {} & TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, br, fg } = useTwBelt()

  return {
    wrapper: cn('row wrap w-full gap-x-3.5 gap-y-3', margin(spacing)),
    box: cn(
      'align-both text-sm border gap-x-1.5 pointer rounded-md py-0.5 px-3.5',
      `hover:${br('text.digest')}`,
      fg('text.digest'),
      br('divider'),
    ),
    boxActive: cn(br('text.digest'), fg('text.title')),
    moreBtn: cn('px-3.5 text-sm pointer', `hover:${fg('text.title')}`, fg('text.digest')),
    inputLabel: cn('mt-2 text-sm', fg('text.digest')),
    flag: cn('size-3.5 border', br('divider')),
  }
}

export const FLAGS = {
  US: USSVG,
  EN: ENSVG,
  DE: DESVG,

  JP: JPSVG,

  CA: CASVG,
  AU: AUSVG,
  TH: THSVG,

  SG: SGSVG,
}
