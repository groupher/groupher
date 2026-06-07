import type { FC } from 'react'

import ArrowSVG from '~/icons/Arrow'
import type { TSpace } from '~/spec'
import Button from '~/widgets/Buttons/Button'

import useSalon from './salon/footer'

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
      <button type='button' className={s.arrowBox} onClick={() => onBack()}>
        <ArrowSVG className={s.arrowIocn} />
      </button>
      <Button
        size='small'
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
