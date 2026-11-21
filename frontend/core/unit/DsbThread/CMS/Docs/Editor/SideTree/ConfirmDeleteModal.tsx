import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import { Button } from '~/ui/Buttons'
import Modal from '~/ui/Modal'

import useSalon from './salon/cover_warning_modal'

type TProps = {
  message: string | null
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
}

const ConfirmDeleteModal: FC<TProps> = ({ message, onConfirm, onCancel, confirmLabel }) => {
  const s = useSalon()
  const { t } = useTrans()
  return (
    <Modal show={!!message} width='360px' compact showCloseBtn offsetTop='28%' onClose={onCancel}>
      <div className={s.wrapper}>
        <div className={s.content}>
          {message?.split('\n').map((line, index) => (
            <p className={s.message} key={`${index}:${line}`}>
              {line}
            </p>
          ))}
        </div>
        <div className={s.footer}>
          <Button size='small' ghost noBorder onClick={onCancel}>
            {t('dsb.doc.queue.cancel')}
          </Button>
          <Button size='small' onClick={onConfirm}>
            {confirmLabel ?? t('dsb.doc.tabs.confirm_delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDeleteModal
