import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, hover, bg } = useTwBelt()

  return {
    button: cn('group align-both size-7 rounded-lg button-reset', fg('digest'), hover('box')),
    buttonActive: cn(fg('title'), bg('hoverBg')),
    icon: cn('size-4.5', fill('digest'), hover('icon')),
    iconActive: fill('title'),
  }
}
