import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'row-center w-full h-12 mb-1.5',
    publishWrapper: 'row-center',
    editedHint: cn('text-sm', fg('link'), 'before:content-["("] after:content-[")"]'),
  }
}
