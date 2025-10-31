import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow, fg, fill } = useTwBelt()

  return {
    wrapper: cn('relative mt-5 w-full h-32', fg('text.digest')),
    header: 'row-center',
    repo: 'text-lg h-full',
    repoName: cn('bold-sm', fg('text.title')),
    repoDesc: cn('text-sm w-full break-all mt-1', fg('text.digest')),
    //
    footer: 'row-center mt-3',
    info: cn('row-center text-sm mr-4', fg('text.title')),
    icon: cn('size-3.5 mr-1.5', fill('text.digest')),
    infoDesc: cn('text-sm', fg('text.digest')),
    //
    langBar: 'w-full row-center -mt-2',
    bar: 'h-1.5',
    bgPurple: rainbow(COLOR_NAME.PURPLE, 'bg'),
    bgBlue: rainbow(COLOR_NAME.BLUE, 'bg'),
    bgYellow: rainbow(COLOR_NAME.YELLOW, 'bg'),
  }
}
