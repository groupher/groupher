/*
 *
 * NoteTip
 *
 */

import type { FC, ReactNode } from 'react'

import InfoSVG from '~/icons/Info'
import type { TSpace, TTooltipPlacement } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import useSalon from './salon'
import { cnMerge } from '~/css'

type TProps = {
  className?: string
  children?: ReactNode
  offset?: [number, number]
  placement?: TTooltipPlacement
} & TSpace

const NoteTip: FC<TProps> = ({
  className = 'text-sm',
  children = 'note tip',
  offset = [-5, -5],
  placement = 'bottom',
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={cnMerge(s.wrapper, className)}>
      <Tooltip
        placement={placement}
        content={<div className={s.note}>{children}</div>}
        offset={offset}
        noPadding
      >
        <InfoSVG className={s.infoIcon} />
      </Tooltip>
    </div>
  )
}

export default NoteTip
