import { type FC, memo } from 'react'

import type { TSpace } from '~/spec'

import BackSVG from '~/icons/Back'

import useSalon from './salon/cancel_button'

type TProps = {
  text?: string
  onClick?: () => void
} & TSpace

const CancelButton: FC<TProps> = ({ text = '取消', onClick = console.log, ...spacing }) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper} onClick={onClick}>
      <BackSVG className={s.backIcon} />
      {text}
    </div>
  )
}

export default memo(CancelButton)
