import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, cut } = useTwBelt()

  return {
    replyBar: cn('row rounded py-1 px-2.5 mx-2.5 mb-2', fg('digest'), bg('sandBox')),
    replyToBody: cn('ml-2.5 mr-5 grow italic', fg('digest'), cut('w-80')),
    replyToFloor: cn('mr-1', fg('hint')),
  }
}
