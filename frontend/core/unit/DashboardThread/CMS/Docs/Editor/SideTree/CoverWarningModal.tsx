import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import { Button } from '~/widgets/Buttons'
import Modal from '~/widgets/Modal'

import useSalon from './salon/cover_warning_modal'

type TProps = {
  message: string | null
  onClose: () => void
}

const CoverWarningModal: FC<TProps> = ({ message, onClose }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <Modal show={!!message} width='360px' compact showCloseBtn offsetTop='28%' onClose={onClose}>
      <div className={s.wrapper}>
        <div className={s.content}>
          <h3 className={s.title}>{t('dsb.cms.docs.side_tree.cover.warning_title')}</h3>
          <p className={s.message}>{message}</p>
        </div>
        <div className={s.footer}>
          <Button size='small' ghost noBorder onClick={onClose}>
            {t('dsb.cms.docs.side_tree.cover.warning_ok')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CoverWarningModal
