import { type FC, memo, type ReactNode } from 'react'

import type { TSpace } from '~/spec'
import { ICON } from '~/config'
import Img from '~/Img'

import Tooltip from '~/widgets/Tooltip'
import useSalon from './salon/icon_button'

export type TProps = {
  path?: string | null
  icon?: string | null
  size?: number
  dimWhenIdle?: boolean
  active?: boolean
  hint?: ReactNode | null
  hintDelay?: number
  hintPlacement?: 'top' | 'bottom'
  onClick?: () => void
} & TSpace

const IconButton: FC<TProps> = ({
  path = null,
  icon = null,
  size = 3.5,
  active = false,
  dimWhenIdle = false,
  hint = null,
  hintDelay = 500,
  hintPlacement = 'top',
  onClick = console.log,
  ...spacing
}) => {
  const s = useSalon({ size, active, dimWhenIdle, ...spacing })

  let realIcon = null

  if (path) {
    // icon from OSS
    realIcon = <Img src={`${ICON}/${path}`} className={s.icon} />
  } else {
    // const LocalIcon = getLocalIcon(icon || SVG.UPVOTE)

    realIcon = <div>TODO</div>
  }

  return (
    <div className={s.wrapper} onClick={onClick} {...spacing}>
      {hint ? (
        <Tooltip
          placement={hintPlacement}
          content={<div className={s.hint}>{hint}</div>}
          noPadding
          delay={hintDelay}
          forceZIndex
        >
          <div className={s.content}>{realIcon}</div>
        </Tooltip>
      ) : (
        <div className={s.content}>{realIcon}</div>
      )}
    </div>
  )
}

export default memo(IconButton)
