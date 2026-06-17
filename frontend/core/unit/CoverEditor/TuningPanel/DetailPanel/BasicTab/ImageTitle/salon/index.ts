import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, sexyBorder } = useTwBelt()

  return {
    wrapper: 'relative row-center w-full mb-3',
    title: cn('text-sm shrink-0 mr-4', fg('title')),
    line: cn(sexyBorder(), 'flex-1 transition-[margin-right] duration-150 delay-100 ease-out'),
    lineWithAction:
      'group-hover:mr-32 group-hover:delay-0 group-focus-within:mr-32 group-focus-within:delay-0',
    action: 'absolute right-0 top-1/2 -translate-y-1/2 pl-4',
    cn,
  }
}
