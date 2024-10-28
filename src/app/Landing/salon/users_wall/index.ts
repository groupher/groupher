import styled from '~/css'

import { COLOR_NAME } from '~/const/colors'

import { getUserwallGradient, getUserwallGradientOpacity } from '../metric'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, global, rainbow } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full relative mt-20'),
    slogan: 'column align-both mb-16',
    title: cn('text-3xl bold-sm opacity-70', fg('text.title'), global('text-shadow')),
    desc: cn('text-lg mt-3', fg('text.digest')),
    //
    wall: 'column-align-both relative w-full h-auto mt-6',
    demoP: 'text-base leading-relaxed',
    p: 'mt-2.5',
    highlight: cn('px-1 bold-sm rounded', fg('text.digest')),
    // colors
    blueBg: cn('', rainbow(COLOR_NAME.BLUE, 'bgSoft')),
    greenBg: cn('', rainbow(COLOR_NAME.GREEN, 'bgSoft')),
    purpleBg: cn('', rainbow(COLOR_NAME.PURPLE, 'bgSoft')),
    orangeBg: cn('', rainbow(COLOR_NAME.ORANGE, 'bgSoft')),
    redBg: cn('', rainbow(COLOR_NAME.RED, 'bgSoft')),
    yellowBg: cn('', rainbow(COLOR_NAME.YELLOW, 'bgSoft')),
    brownBg: cn('', rainbow(COLOR_NAME.BROWN, 'bgSoft')),
    cyanBg: cn('', rainbow(COLOR_NAME.CYAN, 'bgSoft')),
  }
}

export const BgGradient = styled.div<{ wallpaper: string }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: ${({ wallpaper }) => `${getUserwallGradientOpacity(wallpaper)}`};

  background: ${({ wallpaper }) =>
    `radial-gradient(circle at 50% 50%, ${getUserwallGradient(wallpaper)[0]} 0, transparent 35%)`};;
`
