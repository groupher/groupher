import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'w-full',
    body: cn('min-h-72 text-base leading-7', fg('digest')),
    html: 'rich-editor',
    fallback: cn('whitespace-pre-wrap', fg('digest')),
  }
}
