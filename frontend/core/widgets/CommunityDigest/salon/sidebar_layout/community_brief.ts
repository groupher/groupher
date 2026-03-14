import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, linkable, cut } = useTwBelt()

  return {
    wrapper: 'w-4/5 mt-4 pl-1',
    logoBox: 'align-both size-8 z-10',
    logo: 'size-7',
    title: cn('bold-sm text-lg mt-2', fg('title')),
    desc: cn('text-sm mt-1 line-clamp', fg('digest')),
    homeLink: 'row-center text-sm -ml-1 mt-2',
    linkIconBox: 'align-both size-5',
    linkIcon: cn('size-4 mt-px', fill('digest')),
    //
    link: cn(linkable(), cut('w-40')),
  }
}
