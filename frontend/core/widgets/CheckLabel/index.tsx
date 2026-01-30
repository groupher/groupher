/*
 *
 * CheckLabel
 *
 */

import { type FC, memo } from 'react'
import HookSVG from '~/icons/Hook'
import type { TActive, TSpace } from '~/spec'

import useSalon, { cnMerge } from './salon'

type TProps = {
  testid?: string
  title?: string
} & TActive &
  TSpace

const CheckLabel: FC<TProps> = ({
  testid = 'check-label',
  title = '--',
  active = true,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper} data-testid={testid}>
      <HookSVG className={cnMerge(s.checkIcon, active && s.checkIconActive)} />
      <div className={cnMerge(s.title, active && s.titleActive)}>{title}</div>
    </div>
  )
}

export default memo(CheckLabel)
