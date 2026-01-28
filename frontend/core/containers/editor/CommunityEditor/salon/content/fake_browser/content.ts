import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, cut } = useTwBelt()

  return {
    wrapper: 'column relative w-full',
    desc: cn('absolute right-8 top-16 mt-2 text-xs line-clamp-2 w-32 break-all', fg('digest')),
    banner: 'row-between relative h-16 px-20 rounded-md',

    logo: cn('size-6 mr-5 rounded border', br('divider')),
    title: cn('text-sm ml-2 min-w-24', fg('title'), cut('w-24')),
    bar: cn('size-6 rounded', bg('hoverBg')),
    //
    threads: 'row-center gap-x-5 -ml-20',
    threadItem: cn('text-xs', `hover:${fg('title')}`, fg('digest')),
    //
    tags: 'absolute right-0 top-20 w-40 trans-all-200',
    //
    feeds: 'column mt-2.5 ml-20',
    feedBar: cn('h-2.5 w-80 mb-4 rounded-md', bg('hoverBg')),
    //
  }
}
