// Button.tsx
import type { FC, ReactNode } from 'react'
import SIZE from '~/const/size'
import type { TColorName, TSizeTSM, TSpace } from '~/spec'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import useSalon, { cn, cnMerge } from './salon/button'

type TProps = {
  children?: ReactNode
  className?: string

  // style flags
  red?: boolean
  ghost?: boolean
  soft?: boolean
  noBorder?: boolean
  noLeftRound?: boolean

  // sizing/layout
  size?: TSizeTSM
  width?: string

  // new API
  px?: number | null
  py?: number | null

  // ✅ legacy API (backward compatible)
  space?: number | null
  spaceY?: number | null

  // color override
  color?: TColorName | null

  // behavior
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  style?: React.CSSProperties
} & TSpace

const Button: FC<TProps> = ({
  children = 'button',
  className = '',

  red = false,
  ghost = false,
  soft = false,
  noBorder = false,
  noLeftRound = false,

  size = SIZE.MEDIUM,
  width = 'w-fit',

  px = null,
  py = null,

  space = null,
  spaceY = null,

  color = null,

  disabled = false,
  loading = false,
  onClick,
  style,
  ...spacing
}) => {
  const resolvedPx = px ?? space
  const resolvedPy = py ?? spaceY

  const s = useSalon({
    red,
    ghost,
    soft,
    noBorder,
    noLeftRound,

    size,
    width,
    px: resolvedPx,
    py: resolvedPy,

    color,

    disabled,
    loading,
    ...spacing,
  })

  return (
    <button
      className={cnMerge(s.wrapper, className)}
      style={style}
      disabled={disabled}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      onClick={(e) => {
        if (disabled || loading) {
          e.preventDefault()
          return
        }
        onClick?.()
      }}
    >
      <div className={cn(s.inner)}>
        {loading ? <LavaLampLoading size='small' /> : <div className={s.children}>{children}</div>}
      </div>
    </button>
  )
}

export default Button
