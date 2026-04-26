import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import Modal from '~/widgets/Modal'
import NoticeBar from '~/widgets/NoticeBar'

import useSalon from '../../salon/basic_info/danger_zone/modal'
import ConfirmFooter from './ConfirmFooter'
// import from '~/widgets/Alert'
import List from './List'

type TProps = {
  show: boolean
  onClose: () => void
}

const DeleteModal: FC<TProps> = ({ show, onClose }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <Modal show={show} width='390px' offsetLeft='40%' onClose={() => onClose()} showCloseBtn>
      <div className={s.wrapper}>
        <h3 className={s.warningTitle}>{t('dsb.base_info.danger.delete.modal.title')}</h3>
        <div className={s.body}>
          <NoticeBar type='notice' content={t('dsb.base_info.danger.delete.modal.notice')} />

          <List
            items={[
              t('dsb.base_info.danger.delete.modal.item.settings'),
              t('dsb.base_info.danger.delete.modal.item.content'),
              t('dsb.base_info.danger.delete.modal.item.interactions'),
            ]}
            left={6}
            top={5}
          />
        </div>
        <ConfirmFooter bottom={6} />
      </div>
    </Modal>
  )
}

export default DeleteModal
