import type { FC } from 'react'

import Button from '~/widgets/Buttons/Button'

import { FOOTER_BEHAVIOR } from './constant'

import useSalon from './salon/confirm_footer'

type TProps = {
  behavior?: 'default' | 'confirm' | 'delete-confirm' | 'add'

  onConfirm?: () => void
  onCancel?: () => void
}

const ConfirmFooter: FC<TProps> = ({ onConfirm, onCancel, behavior }) => {
  const s = useSalon()
  let content = null

  switch (behavior) {
    case FOOTER_BEHAVIOR.DELETE_CONFIRM: {
      content = (
        <div className={s.bottomWrapper}>
          <button type='button' className={s.cancelBtn} onClick={onCancel}>
            取消
          </button>
          <div className='mr-2.5' />
          <Button size='tiny' red onClick={() => onConfirm?.()}>
            确定
          </Button>
        </div>
      )
      break
    }

    case FOOTER_BEHAVIOR.ADD: {
      content = (
        <div className={s.bottomWrapper}>
          <Button size='small' onClick={() => onConfirm?.()}>
            添加
          </Button>
          <div className='mr-2.5' />
          <button type='button' className={s.cancelBtn} onClick={() => onCancel?.()}>
            取消
          </button>
        </div>
      )
      break
    }

    default: {
      content = (
        <div className={s.bottomWrapper}>
          <Button size='small' onClick={onConfirm}>
            确定
          </Button>
          <div className='mr-2.5' />
          <button type='button' className={s.cancelBtn} onClick={() => onCancel?.()}>
            取消
          </button>
        </div>
      )
      break
    }
  }

  return <div className={s.wrapper}>{content}</div>
}

export default ConfirmFooter
