import type { TSpace, TSizeTSM, TColorName } from '~/spec'

import { getHeight, getPadding, getRouned, getFontSize } from './metircs/button'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import { COLOR_NAME } from '~/const/colors'

export { cn } from '~/css'

type TProps = {
  ghost?: boolean
  type?: 'primary' | 'red'
  width: string
  space?: number | null
  size?: TSizeTSM
  noBorder?: boolean
  loading: boolean
  disabled?: boolean
  noLeftRouned: boolean
  color?: TColorName | null
} & TSpace

export default ({
  type,
  width,
  ghost,
  noBorder,
  size,
  space,
  disabled,
  loading,
  noLeftRouned,
  color,
  ...spacing
}: TProps) => {
  const { isLightTheme } = useTheme()
  const { cn, margin, primary, br, fg, bg, rainbow, isDarkBlack } = useTwBelt()

  const isRed = type === 'red'
  const common = 'group select-none touch-manipulation outline-none bg-none whitespace-nowrap'

  return {
    wrapper: cn(
      common,
      disabled && 'saturate-50 cursor-not-allowed',
      !ghost && !isRed && !noBorder && 'border border-4',
      width,
      'rounded-xl',
      br('divider'),
      !ghost && bg('divider'),
      loading && bg('transparent'),
      margin(spacing),
    ),
    inner: cn(
      'align-both relative text-center break-keep border border-transparent pointer',
      'hover:brightness-110 active:brightness-95 trans-all-200',
      ghost && 'hover:brightness-125',
      noBorder && 'border-0',
      getRouned(size),
      getPadding(size),
      getHeight(size),
      space && `px-${space}`,
      getFontSize(size),
      noLeftRouned && 'rounded-tl-none rounded-bl-none',
      !ghost && primary('bg'),
      !ghost && isDarkBlack && bg('rainbow.blackBtn'),
      ghost && `hover:${primary('bgSoft')}`,
      ghost && bg('transparent'),
      ghost && !color ? primary('fg') : fg('button.fg'),
      ghost && !color && isDarkBlack && fg('text.digest'),
      isRed && 'border-transparent',
      isRed && ghost && rainbow(COLOR_NAME.RED, 'borderSoft'),
      loading && bg('transparent'),
      color && !ghost && rainbow(color, 'bg'),
      color && ghost && rainbow(color, 'fg'),
      ghost && rainbow(color, 'borderSoft'),
      ghost && !color && isDarkBlack && br('text.hint'),
    ),
    innerRed: cn(
      'hover:brightness-105 active:brightness-95 trans-all-200',
      ghost ? bg('alphaBg') : bg('button.redBg'),
      fg('rainbow.red'),
    ),
    children: cn('align-both relative w-auto', !isLightTheme && 'brightness-110'),
  }
}
