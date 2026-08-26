import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'column px-6 py-4 pb-0 h-40 w-[480px] border z-30 rounded-xl',
      'absolute top-44 -left-6 mt-2',
      bg('card'),
      br('divider'),
      shadow('xl'),
    ),
    url: cn('text-xs opacity-80 mb-0.5', fg('digest')),
    title: cn('text-lg opacity-80 mb-0.5', fg('title')),
    desc: cn('text-xs opacity-80 mt-1', fg('digest')),
    //
    footer: 'row-center mt-5 -ml-0.5',
    logoBox: 'align-both size-6 mr-2',
    logo: 'size-4',
    //
    hint: cn('text-xs opacity-65', fg('digest')),
  }
}
