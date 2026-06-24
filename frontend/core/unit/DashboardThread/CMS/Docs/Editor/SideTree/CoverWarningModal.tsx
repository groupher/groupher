import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import { Button } from '~/widgets/Buttons'
import Modal from '~/widgets/Modal'

type TProps = {
  message: string | null
  onClose: () => void
}

const CoverWarningModal: FC<TProps> = ({ message, onClose }) => {
  const { t } = useTrans()

  return (
    <Modal show={!!message} width='360px' compact showCloseBtn offsetTop='28%' onClose={onClose}>
      <div className='column gap-4 px-5 pt-5 pb-4'>
        <div className='column gap-2 pr-8'>
          <h3 className='text-title bold-sm text-base'>
            {t('dsb.cms.docs.side_tree.cover.warning_title')}
          </h3>
          <p className='text-digest text-sm leading-6'>{message}</p>
        </div>
        <div className='row justify-end pt-1'>
          <Button size='small' ghost noBorder onClick={onClose}>
            {t('dsb.cms.docs.side_tree.cover.warning_ok')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CoverWarningModal
