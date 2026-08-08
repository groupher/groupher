import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, rainbow } = useTwBelt()

  return {
    wrapper: cn('w-full h-8', fg('button.fg')),
    inner: 'row-between relative px-6',
    desc: 'text-sm bold-sm',
    linkText: cn('text-sm bold-sm text-xs underline', fg('button.fg')),
    linkBtn: cn('px-3 py-px rounded bold-sm pointer hover-underline border-0', fg('button.fg')),
    icon: cn('size-4 mr-3', fill('button.fg')),
    rainbow,
  }
}
