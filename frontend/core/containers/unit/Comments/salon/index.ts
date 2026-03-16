import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, cut } = useTwBelt()

  return {
    wrapper: '',
    replyBar: cn('row rounded px-2.5 py-1 mx-2.5 mb-2', fg('digest'), bg('hoverBg')),
    replyToBody: cn('ml-2.5 mr-5 grow italic', fg('title'), cut('w-80')),
    replyToFloor: cn('ml-1', fg('hint')),
  }
}
