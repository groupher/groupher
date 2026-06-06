import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg, fg, fill, primary } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-both w-full h-full rounded-lg border outline-none trans-all-100 relative overflow-hidden pointer',
      `hover:${primary('border')}`,
      `focus-visible:${primary('border')}`,
      br('divider'),
      bg('card'),
    ),
    inner: cn('column-align-both h-full w-full pointer-events-none', bg('hoverBg')),
    wrapperActive: primary('border'),
    dashedFrame: cn(
      'absolute inset-5 rounded-md border border-dashed pointer-events-none',
      br('divider'),
    ),
    uploadIcon: cn('size-10 opacity-50 mb-5 z-10', fill('digest')),
    title: cn('text-xl mb-3 z-10', fg('digest')),
    desc: cn('column-align-both text-base z-10', fg('hint')),
  }
}
