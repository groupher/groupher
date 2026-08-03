import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { bg, cn, fg, hoverBr } = useTwBelt()

  return {
    wrapper: 'row -ml-1',
    inner: 'grid w-full grid-cols-1 gap-6 md:grid-cols-2',
    // hoverBorder
    block: cn('align-start h-44 w-full rounded-md p-4 text-left pointer', bg('card'), hoverBr()),
    iconBox: 'align-both size-16 mb-1 -ml-2 overflow-hidden',
    icon: 'block size-10 object-contain',
    title: cn('text-base mb-1', fg('title')),
    desc: cn('text-sm block text-left', fg('digest')),
  }
}
