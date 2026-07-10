import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, hover } = useTwBelt()

  return {
    wrapper: 'mb-8',
    top: 'align-both mb-8',
    backBtn: cn('align-both px-2 py-0.5 rounded-xl', hover('bg')),
    backIcon: cn('size-2.5 mr-2', hover('icon')),
    backText: cn('text-sm', hover('fg')),
    title: cn('text-3xl bold-sm leading-tight', fg('title')),
    subtitle: cn('mt-3 text-lg leading-7', fg('digest')),
    innerId: cn('mt-3 text-sm opacity-60', fg('digest')),
    error: cn('text-2xl bold-sm', fg('title')),
  }
}
