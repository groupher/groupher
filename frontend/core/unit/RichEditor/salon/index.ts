import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  fluid: boolean
}

export default function useSalon({ fluid }: TProps) {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'relative w-full',
    inner: cn('w-full', fluid ? 'max-w-none' : 'max-w-3xl'),
    editor: cn('min-h-96 w-full debug-g', fg('title')),
  }
}
