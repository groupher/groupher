import type { FC, ReactNode } from 'react'
import SIZE from '~/const/size'
import type { TColorName, TSizeTSM, TSpace } from '~/spec'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import useSalon, { cn, cnMerge } from './salon/button'

type TProps = {
  ariaLabel?: string
  children?: ReactNode
  className?: string

  // style flags
  red?: boolean
  ghost?: boolean
  soft?: boolean
  noBorder?: boolean
  iconOnly?: boolean
  noLeftRound?: boolean
  noRightRound?: boolean

  // sizing/layout
  size?: TSizeTSM
  width?: string

  space?: number | null
  spaceY?: number | null

  // color override
  color?: TColorName | null

  // behavior
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
} & TSpace

const Button: FC<TProps> = ({
  ariaLabel = undefined,
  children = 'button',
  className = '',

  red = false,
  ghost = false,
  soft = false,
  noBorder = false,
  iconOnly = false,
  noLeftRound = false,
  noRightRound = false,

  size = SIZE.MEDIUM,
  width = 'w-fit',

  space = null,
  spaceY = null,

  color = null,

  disabled = false,
  loading = false,
  onClick,
  ...spacing
}) => {
  const s = useSalon({
    red,
    ghost,
    soft,
    noBorder,
    iconOnly,
    noLeftRound,
    noRightRound,

    size,
    width,
    px: space,
    py: spaceY,

    color,

    disabled,
    loading,
    ...spacing,
  })

  if (loading) {
    return (
      <div className={cnMerge(s.wrapper, className, 'border-0 bg-transparent')} aria-busy>
        <div className={cnMerge(s.inner, 'bg-transparent border-transparent')} style={s.innerStyle}>
          <div className={cn(s.children, 'invisible select-none')}>{children}</div>
          <div className='absolute inset-0 align-both'>
            <LavaLampLoading size='small' className='!w-10 !h-3 overflow-hidden' />
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      type='button'
      className={cnMerge(s.wrapper, className)}
      disabled={disabled}
      aria-label={ariaLabel}
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
      <div className={cn(s.inner)} style={s.innerStyle}>
        <div className={s.children}>{children}</div>
      </div>
    </button>
  )
}

export default Button
