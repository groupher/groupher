/*
 *
 * ArrowButtons
 *
 */

import type { FC, ReactNode } from 'react'
import usePrimaryColor from '~/hooks/usePrimaryColor'
import type { TColorName, TSpace } from '~/spec'
import useSalon, { cnMerge } from '../salon/arrow_button'
import Arrow from './Arrow'

export type TProps = {
  as?: 'button' | 'span'
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
  as = 'button',
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
  const isLeft = leftLayout || up || down
  const s = useSalon({ disabled, dimWhenIdle, leftLayout: isLeft, ...spacing })
  const primaryColor = usePrimaryColor()
  const content = (
    <>
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
    </>
  )

  if (as === 'span') {
    return <span className={cnMerge(s.wrapper, className)}>{content}</span>
  }

  return (
    <button
      className={cnMerge(s.wrapper, className)}
      onClick={() => !disabled && onClick()}
      type='button'
    >
      {content}
    </button>
  )
}

export default ArrowButton
