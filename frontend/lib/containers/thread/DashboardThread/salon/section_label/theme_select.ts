import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, fill, sexyVBorder } = useTwBelt()

  return {
    wrapper: 'row-center',
    section: 'row-center smoky-65 transition-colors',
    sectionActive: '!opacity-100',
    title: cn('ml-0.5 text-xs', fg('text.title')),
    icon: cn('size-3.5', fill('text.digest')),
    dovider: cn(sexyVBorder(35), 'h-5 ml-2 mr-2'),
  }
}
