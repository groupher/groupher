import type { FC } from 'react'

import type { TSpace } from '~/spec'
import Button from '~/widgets/Buttons/Button'

import ArrowSVG from '~/icons/Arrow'

import useSalon from '../styles/sub_menu/footer'

type TProps = {
  onBack: () => void
  onConfirm: () => void
  loading?: boolean
  disabled?: boolean
} & TSpace

const Footer: FC<TProps> = ({
  onBack,
  onConfirm,
  loading = false,
  disabled = false,
  ...spacing
}) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper}>
      <div className={s.arrowBox} onClick={() => onBack()}>
        <ArrowSVG className={s.arrowIocn} />
      </div>
      <Button
        size="small"
        onClick={() => onConfirm()}
        loading={loading}
        disabled={disabled}
        space={3}
      >
        确认
      </Button>
    </div>
  )
}

export default Footer
