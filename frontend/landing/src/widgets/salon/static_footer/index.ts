import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br, fill } = useTwBelt()

  return {
    wrapper: 'relative z-10 w-full mt-16 py-12 footer-inner-shadow',
    inner: 'mx-auto w-full max-w-6xl px-6 sm:px-10 lg:px-16',
    main: 'grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4',
    brand: 'col-span-2 flex flex-col items-start',
    brandLink: cn('inline-flex items-center gap-2 text-base font-semibold', fg('title')),
    logo: 'size-8 rounded-lg object-cover',
    tagline: cn('mt-4 max-w-xs text-sm', fg('digest')),
    socialLink: cn('mt-5 inline-flex size-9 items-center justify-center rounded-lg', fg('digest')),
    socialIcon: cn('size-5', fill('digest')),
    column: 'flex flex-col',
    columnTitle: cn('mb-4 text-sm font-semibold', fg('title')),
    links: 'flex flex-col gap-3',
    link: cn('text-sm hover:underline', fg('digest')),
    bottom: cn(
      'mt-12 flex items-center justify-between gap-4 border-t pt-6 text-xs',
      br('divider'),
      fg('digest'),
    ),
  }
}
