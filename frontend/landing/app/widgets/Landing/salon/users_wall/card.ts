import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { isLightTheme } = useTheme()
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('w-80 h-auto rounded-md p-5 mb-4 trans-all-100', fg('text.digest')),
    header: 'row-center mb-2.5',
    avatar: cn('size-8 border-2 p-0.5 rounded-lg', rainbow(color, 'border')),
    nickname: cn('ml-2.5 text-sm', fg('text.title')),

    content: cn(
      'underline underline-offset-8 decoration-dashed',
      isLightTheme ? 'decoration-black/10' : 'decoration-white/15',
    ),
  }
}
