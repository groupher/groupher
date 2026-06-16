import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'relative w-full',
    inner: 'w-full max-w-3xl',
    editor: cn('min-h-96 w-full debug-g', fg('title')),
  }
}
