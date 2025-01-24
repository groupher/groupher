import type { FC, ReactNode } from 'react'

import type { TActive, TSizeTS, TSpace, TButtonPrefix } from '~/spec'
import SIZE from '~/const/size'

import ArrowSVG from '~/icons/ArrowSimple'
import CloseSVG from '~/icons/CloseLight'

import PrefixIcon from './PrefixIcon'

import useSalon from '../salon/dropdown_button'

type TProps = {
  children: ReactNode
  size?: TSizeTS
  withBorder?: boolean
  onClick?: () => void
  onClear?: () => void
  noArrow?: boolean
  selected?: boolean
  closable?: boolean
  prefixIcon?: TButtonPrefix
} & TSpace &
  TActive

const DropdownButton: FC<TProps> = ({
  children,
  size = SIZE.SMALL,
  withBorder = false,
  onClick = console.log,
  onClear = console.log,
  noArrow = false,
  $active = false,
  selected = false,
  closable = false,
  prefixIcon = null,
  ...spacing
}) => {
  const s = useSalon({ size, selected, active: $active, ...spacing })

  return (
    <div className={s.wrapper} onClick={onClick}>
      <button className={s.button}>
        <div className={s.inner}>
          <PrefixIcon type={prefixIcon} />
          {children}
          {!noArrow && !(closable && selected) && <ArrowSVG className={s.arrowIcon} />}
          {closable && selected && (
            <div
              className={s.closeBox}
              onClick={(e) => {
                e.preventDefault()
                onClear()
              }}
            >
              <CloseSVG className={s.closeIcon} />
            </div>
          )}
        </div>
      </button>
    </div>
  )
}

export default DropdownButton
