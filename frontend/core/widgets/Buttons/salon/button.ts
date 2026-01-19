import { COLOR_NAME } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName, TSizeTSM, TSpace } from '~/spec'
import { getFontSize, getHeight, getPadding, getRound } from './metircs/button'

export { cn } from '~/css'

type TProps = {
  ghost?: boolean
  type?: 'primary' | 'red'
  width: string
  space: number | null
  spaceY: number | null
  size?: TSizeTSM
  noBorder: boolean
  withSoftBg: boolean
  loading: boolean
  disabled: boolean
  noLeftRound: boolean
  color?: TColorName | null
} & TSpace

export default ({
  type,
  width,
  ghost,
  noBorder,
  withSoftBg,
  size,
  space,
  spaceY,
  disabled,
  loading,
  noLeftRound,
  color,
  ...spacing
}: TProps) => {
  const { isLightTheme } = useTheme()
  const { cn, margin, primary, br, fg, bg, rainbow, isDarkBlack } = useTwBelt()

  const isRed = type === 'red'
  const common = 'group w-max select-none touch-manipulation outline-none bg-none whitespace-nowrap'

  return {
    wrapper: cn(
      common,
      !ghost && !isRed && !noBorder && 'border-4',
      disabled && 'border-2',
      width,
      'rounded-xl',
      br('divider'),
      !ghost && bg('divider'),
      loading && bg('transparent'),
      margin(spacing),
    ),
    inner: cn(
      'align-both w-max relative text-center break-keep border border-transparent pointer',
      'hover:brightness-110 active:brightness-95 trans-all-200',
      ghost && 'hover:brightness-125',
      noBorder && 'border-0',
      getRound(size),
      getPadding(size),
      getHeight(size),
      space && `px-${space}`,
      spaceY && `py-${spaceY}`,
      getFontSize(size),
      noLeftRound && 'rounded-tl-none rounded-bl-none',
      !ghost && primary('bg'),
      !ghost && isDarkBlack && bg('rainbow.blackBtn'),
      ghost && `hover:${primary('bgSoft')}`,
      ghost && color && `hover:${rainbow(color, 'bgSoft')}`,
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
      !ghost && !color && isDarkBlack && fg('button.blackFg'),
      withSoftBg && color && rainbow(color, 'bgSoft'),
      withSoftBg && isLightTheme && !color && 'hover:brightness-95',
      withSoftBg && !color && bg('hoverBg'),
      disabled &&
        !ghost &&
        isLightTheme &&
        cn(
          'brightness-90 hover:brightness-90 hover:cursor-not-allowed',
          bg('hoverBg'),
          fg('text.hint'),
        ),
      disabled &&
        !ghost &&
        !isLightTheme &&
        cn(
          'brightness-125 hover:brightness-125 hover:cursor-not-allowed',
          bg('hoverBg'),
          fg('text.hint'),
        ),
    ),
    innerRed: cn(
      'hover:brightness-105 active:brightness-95 trans-all-200',
      ghost ? bg('alphaBg') : bg('button.redBg'),
      fg('rainbow.red'),
    ),
    children: cn('align-both relative w-auto px-2', !isLightTheme && 'brightness-110'),
  }
}
