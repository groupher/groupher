import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column gap-4 px-5 pt-5 pb-4',
    content: 'column gap-2 pr-8',
    title: cn('bold-sm text-base', fg('title')),
    message: cn('text-sm leading-6', fg('digest')),
    footer: 'row justify-end pt-1',
  }
}
