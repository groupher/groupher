import { COLOR_NAME } from '~/const/colors'
import { cnMerge } from '~/css'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName, TSizeTSM, TSpace } from '~/spec'
import { getFontSize, getHeight, getPadding, getRound } from './metircs/button'

export { cn, cnMerge } from '~/css'

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
  const { cn, margin, primary, br, fg, bg, rainbow } = useTwBelt()

  const isRed = type === 'red'
  const common = 'group w-max select-none touch-manipulation outline-none bg-none whitespace-nowrap'

  return {
    wrapper: cnMerge(
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
    inner: cnMerge(
      'align-both w-max relative text-center break-keep border border-transparent',
      disabled ? 'cursor-not-allowed' : 'pointer',
      !disabled && 'hover:brightness-110 active:brightness-95 trans-all-200',
      disabled && 'dark:brightness-90',
      ghost && !disabled && 'hover:brightness-125',
      noBorder && 'border-0',
      getRound(size),
      getPadding(size),
      getHeight(size),
      space && `px-${space}`,
      spaceY && `py-${spaceY}`,
      getFontSize(size),
      noLeftRound && 'rounded-tl-none rounded-bl-none',
      !ghost && primary('bg'),

      ghost && !disabled && `hover:${primary('bgSoft')}`,
      ghost && !disabled && color && `hover:${rainbow(color, 'bgSoft')}`,

      ghost && bg('transparent'),
      ghost && !color ? primary('fg') : fg('button.fg'),
      isRed && 'border-transparent',
      isRed && ghost && rainbow(COLOR_NAME.RED, 'borderSoft'),
      loading && bg('transparent'),
      color && !ghost && rainbow(color, 'bg'),
      color && ghost && rainbow(color, 'fg'),
      ghost && rainbow(color, 'borderSoft'),
      ghost && !color && br('text.hint'),
      !ghost && !color && fg('black'),

      withSoftBg && color && rainbow(color, 'bgSoft'),
      withSoftBg && !color && bg('hoverBg'),
    ),
    innerRed: cn(
      !disabled && 'hover:brightness-105 active:brightness-95 trans-all-200',
      rainbow(COLOR_NAME.RED, 'bgSoft'),
      fg('rainbow.red'),
    ),
    children: cn('align-both relative w-auto px-2'),
  }
}
