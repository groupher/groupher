import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg } = useTwBelt()

  return {
    wrapper: 'row-center w-full h-12 mt-4',
    title: cn('text-base bold-sm', fg('title')),
    divider: cn('w-px h-3 ml-4 mr-3.5 mt-px', bg('text.digest')),
    subTitle: cn('text-sm bold-sm mt-px', fg('digest')),
    //
    right: 'row-center gap-x-3 -mt-0.5',
  }
}
