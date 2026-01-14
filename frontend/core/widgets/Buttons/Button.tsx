import type { FC, ReactNode } from 'react'
import SIZE from '~/const/size'
import type { TColorName, TSizeTSM, TSpace } from '~/spec'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import useSalon, { cn } from './salon/button'

type TProps = {
  children?: ReactNode
  className?: string
  ghost?: boolean
  type?: 'primary' | 'red'
  width?: string
  space?: number | null
  spaceY?: number | null
  size?: TSizeTSM
  onClick?: () => void
  loading?: boolean
  noBorder?: boolean
  withSoftBg?: boolean
  disabled?: boolean
  noLeftRound?: boolean
  color?: TColorName | null
  style?: any
} & TSpace

const Button: FC<TProps> = ({
  children = 'button',
  ghost = false,
  type = 'primary',
  width = 'w-fit',
  onClick = console.log,
  space = null,
  spaceY = null,
  size = SIZE.MEDIUM,
  className = '',
  loading = false,
  noBorder = false,
  withSoftBg = false,
  disabled = false,
  noLeftRound = false,
  color = null,
  style = {},
  ...spacing
}) => {
  const s = useSalon({
    type,
    width,
    ghost,
    space,
    spaceY,
    size,
    noBorder,
    withSoftBg,
    disabled,
    loading,
    noLeftRound,
    color,
    ...spacing,
  })

  const isRed = type === 'red'

  return (
    <button
      className={cn(s.wrapper, className)}
      style={style}
      onClick={() => !disabled && onClick()}
    >
      <div className={cn(s.inner, isRed && s.innerRed)}>
        {loading && <LavaLampLoading size='small' />}
        {!loading && <div className={s.children}>{children}</div>}
      </div>
    </button>
  )
}

export default Button
