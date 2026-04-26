import type { FC } from 'react'

import Button from './Button'
import useSalon from './salon/yes_or_no_buttons'

type TProps = {
  align?: 'center' | 'right'
  cancelText?: string
  saveText?: string
  loading?: boolean
  disabled?: boolean
  onCancel?: () => void
  onConfirm?: () => void
  space?: number
}

const YesOrNoButton: FC<TProps> = ({
  align = 'center',
  cancelText = '取消',
  saveText = '确定',
  onCancel = console.log,
  onConfirm = console.log,
  disabled = false,
  loading = false,
  space = 1,
}) => {
  const s = useSalon({ align })

  return (
    <div className={s.wrapper}>
      {!loading && (
        <button type='button' className={s.cancelBtn} onClick={() => onCancel?.()}>
          {cancelText}
        </button>
      )}
      <div className='mr-2 ml-1.5' />
      <Button
        size='small'
        loading={loading}
        disabled={disabled}
        noBorder
        space={space}
        onClick={() => onConfirm?.()}
      >
        {saveText}
      </Button>
    </div>
  )
}

export default YesOrNoButton
