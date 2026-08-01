export { SocialIcon } from './panel'

import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, shadow } = useTwBelt()

  return {
    wrapper: cn('column-align-both absolute top-0 left-0 s-full z-50', bg('card')),
    iconWrapper: 'column-align-both mb-8 mt-10 relative',
    title: cn('row gap-1 text-xl bold', fg('digest')),
    desc: cn('w-full px-8 text-center text-sm leading-6 min-h-12', fg('digest')),
    sideLogo: cn('absolute -bottom-3 -right-4 z-20', shadow('xl')),
    icon: 'size-10',

    maskCenter: cn(
      'w-[68%] h-20',
      bg('card'),
      'absolute left-[15%] bottom-[75px]',
      'rounded-lg',
      'z-30',
    ),
    maskTop: cn('w-[90%] h-10', bg('card'), 'absolute left-4 top-3', 'rounded-lg', 'z-30'),
    maskBottom: cn('w-[90%] h-10', bg('card'), 'absolute left-4 bottom-4', 'rounded-lg', 'z-30'),

    //
    providerLogo: 'scale-150 animate-pulse animate-duration-[800ms]',
    providerName: cn('bold', fg('title')),
    //
    footer: 'mt-10 -ml-16 opacity-65',
  }
}
