import useTwBelt from '~/hooks/useTwBelt'
import AUSVG from '~/icons/nation/AU'
import CASVG from '~/icons/nation/CA'
import DESVG from '~/icons/nation/DE'
import ENSVG from '~/icons/nation/EN'
import JPSVG from '~/icons/nation/JP'
import SGSVG from '~/icons/nation/SG'
import THSVG from '~/icons/nation/TH'
import USSVG from '~/icons/nation/US'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {} & TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin, br, fg } = useTwBelt()

  return {
    wrapper: cn('row wrap w-full gap-x-3.5 gap-y-3', margin(spacing)),
    box: cn(
      'align-both text-sm border gap-x-1.5 pointer rounded-md py-0.5 px-3.5',
      `hover:${br('digest')}`,
      fg('digest'),
      br('divider'),
    ),
    boxActive: cn(br('digest'), fg('title')),
    moreBtn: cn('px-3.5 text-sm pointer', `hover:${fg('title')}`, fg('digest')),
    inputLabel: cn('mt-2 text-sm', fg('digest')),
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
