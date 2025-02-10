/*
 *
 * ArrowButtons
 *
 */

import type { FC, ReactNode } from 'react'

import type { TColorName, TSpace } from '~/spec'

import usePrimaryColor from '~/hooks/usePrimaryColor'

import Arrow from './Arrow'
import useSalon, { cn } from '../salon/arrow_button'

export type TProps = {
  children?: ReactNode
  onClick?: () => void
  dimWhenIdle?: boolean
  disabled?: boolean
  color?: TColorName | null
  reverseColor?: boolean
  className?: string
  leftLayout?: boolean
  up?: boolean
  down?: boolean
  fontSize?: number
  initWidth?: number
} & TSpace

const ArrowButton: FC<TProps> = ({
  children = '下一步',
  onClick = console.log,
  dimWhenIdle = false,
  disabled = false,
  color = null,
  className = '',
  leftLayout = false,
  reverseColor = false,
  up = false,
  down = false,
  fontSize = 13,
  initWidth = 55,
  ...spacing
}) => {
  const s = useSalon({ disabled, dimWhenIdle, leftLayout, ...spacing })

  const primaryColor = usePrimaryColor()
  const isLeft = leftLayout || up || down

  return (
    <div className={cn(s.wrapper, className)} onClick={() => !disabled && onClick()}>
      {isLeft && (
        <Arrow
          color={color || primaryColor}
          reverseColor={reverseColor}
          leftLayout={leftLayout}
          up={up}
          down={down}
        />
      )}
      <div className={s.text}>{children}</div>
      {!isLeft && (
        <Arrow
          color={color || primaryColor}
          reverseColor={reverseColor}
          leftLayout={leftLayout}
          up={up}
          down={down}
        />
      )}
    </div>
  )
}

export default ArrowButton
