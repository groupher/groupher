import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, br, fg } = useTwBelt()

  return {
    wrapper: cn(bg('card'), fg('title')),
    picker: 'size-6 circle overflow-hidden scale-[0.82]',
    hud: cn('size-5 circle border shadow-sm shrink-0 overflow-hidden', br('divider')),
    noiseDot: cn('absolute rounded-full opacity-80', bg('digest')),
    tile: cn('h-1.5 rounded-none shadow-sm', bg('digest')),
    dot: cn('size-0.5 rounded-full shadow-sm', bg('digest')),
    beam: cn('h-full w-1', bg('digest')),
    oilPatch: cn('absolute rounded-[2px] shadow-sm opacity-80', bg('digest')),
  }
}
