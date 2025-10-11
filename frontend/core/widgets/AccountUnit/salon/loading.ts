export { SocialIcon } from './panel'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, shadow } = useTwBelt()

  return {
    wrapper: cn('align-both absolute top-0 left-0 w-full h-full backdrop-blur-md z-50'),
    iconWrapper: 'column-align-both mb-5 -mt-6 relative',
    title: cn('text-xl bold', fg('text.digest')),
    desc: cn('text-sm', fg('text.digest')),
    sideLogo: cn('absolute -bottom-3 -right-4 z-20', shadow('xl')),
    icon: 'size-10',

    maskCenter: cn(
      'w-[68%] h-20',
      bg('container'),
      'absolute left-[15%] bottom-[75px]',
      'rounded-lg',
      'opacity-80',
      'z-30',
    ),
    maskTop: cn(
      'w-[90%] h-10',
      bg('container'),
      'absolute left-4 top-3',
      'rounded-lg',
      'opacity-70',
      'z-30',
    ),
    maskBottom: cn(
      'w-[90%] h-10',
      bg('container'),
      'absolute left-4 bottom-4',
      'rounded-lg',
      'opacity-70',
      'z-30',
    ),

    //
    providerLogo: cn('scale-150 animate-pulse animate-duration-[800ms]'),
    providerName: cn('bold', fg('text.title')),
    //
    footer: 'absolute bottom-8 left-[38%] opacity-65',
  }
}
