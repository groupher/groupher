// salon/button.ts
import { COLOR } from '~/const'
import { cnMerge } from '~/css'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName, TSizeTSM, TSpace } from '~/spec'
import { getFontSize, getHeight, getPadding, getRound } from '../metrics/button'
import { buttonInner, buttonWrapper } from './variants'

export { cn, cnMerge } from '~/css'

type TProps = {
  red: boolean
  ghost: boolean
  soft: boolean
  noBorder: boolean
  noLeftRound: boolean

  width: string
  px: number | null
  py: number | null
  size: TSizeTSM

  color: TColorName | null

  loading: boolean
  disabled: boolean
} & TSpace

export default function useButtonSalon({
  red,
  ghost,
  soft,
  noBorder,
  noLeftRound,

  width,
  px,
  py,
  size,

  color,
  loading,
  disabled,
  ...spacing
}: TProps) {
  const { cn, bg, fg, br, primary, rainbow, margin } = useTwBelt()

  const tone = color ? 'color' : red ? 'red' : 'primary'
  const interactive = !disabled && !loading

  // ✅ wrapper border: red/noBorder always none (even when disabled); otherwise disabled/default
  let wrapperBorder: 'default' | 'none' | 'disabled' = 'default'
  if (red || noBorder) {
    wrapperBorder = 'none'
  } else if (disabled) {
    wrapperBorder = 'disabled'
  }

  const wrapperBase = buttonWrapper({
    border: wrapperBorder,
    width: width === 'w-full' ? 'full' : 'fit',
  })

  const innerBase = buttonInner({
    mode: ghost ? 'ghost' : 'solid',
    interactive,
    soft,
    noLeftRound,
  })

  const toneBg = () => {
    if (ghost) return bg('transparent')
    if (tone === 'color') return rainbow(color!, 'bg')
    if (tone === 'red') return rainbow(COLOR.RED, 'bgSoft')
    return primary('bg')
  }

  const toneFg = () => {
    if (ghost && tone === 'primary') return primary('fg')
    if (tone === 'color') return rainbow(color!, 'fg')
    if (tone === 'red') return fg('rainbow.red')
    return fg('button.fg')
  }

  const solidPrimaryFgOverride = () => {
    if (!ghost && tone === 'primary') return fg('black')
    return ''
  }

  const ghostBorder = () => {
    if (!ghost) return ''
    if (color) return rainbow(color, 'borderSoft')
    if (red) return rainbow(COLOR.RED, 'borderSoft')
    return br('text.hint')
  }

  const ghostHoverBg = () => {
    if (!ghost || !interactive) return ''
    if (color) return `hover:${rainbow(color, 'bgSoft')}`
    return `hover:${primary('bgSoft')}`
  }

  const softBg = () => {
    if (!soft) return ''
    if (color) return rainbow(color, 'bgSoft')
    return bg('hoverBg')
  }

  return {
    wrapper: cnMerge(
      wrapperBase,
      'rounded-xl',

      !(red || noBorder) && br('divider'),

      !ghost && bg('divider'),
      loading && bg('transparent'),
      margin(spacing),
    ),

    inner: cnMerge(
      innerBase,

      getRound(size),
      getPadding(size),
      getHeight(size),
      getFontSize(size),

      px != null && `px-${px}`,
      py != null && `py-${py}`,

      toneBg(),
      toneFg(),
      solidPrimaryFgOverride(),

      ghostBorder(),
      ghostHoverBg(),
      softBg(),
    ),

    children: cn('align-both relative w-auto px-2'),
  }
}
