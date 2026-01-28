import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, sexyBorder } = useTwBelt()

  return {
    wrapper: 'column p-5 pb-3 h-full',
    header: 'row-center',
    title: cn('text-lg grow', fg('title')),
    enable: cn('text-sm mr-1', fg('hint')),
    subTitle: cn('text-base', fg('title')),
    content: cn('flex-1', 'mt-2'),
    desc: cn('text-sm', fg('digest')),
    br: cn('my-6', sexyBorder()),
    link: cn('hover:underline text-sm', fg('link')),
    iconBox: 'align-both size-12 mr-1 -ml-2',
    icon: 'size-7',

    footer: 'row-between',
  }
}
