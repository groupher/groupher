import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'
import Modal from '~/widgets/Modal'
import NoticeBar from '~/widgets/NoticeBar'

import useBaseInfo from '../../logic/useBaseInfo'
import useSalon from '../../salon/basic_info/danger_zone/modal'
// import from '~/widgets/Alert'
import List from './List'

type TProps = {
  show: boolean
  onClose: () => void
}

const ArchiveModal: FC<TProps> = ({ show, onClose }) => {
  const s = useSalon()
  const { archiveCommunity } = useBaseInfo()
  const { t } = useTrans()

  return (
    <Modal show={show} width='390px' offsetLeft='40%' onClose={() => onClose()} showCloseBtn>
      <div className={s.wrapper}>
        <h3 className={s.warningTitle}>{t('dsb.base_info.danger.archive.modal.title')}</h3>
        <div className={s.body}>
          <NoticeBar type='notice' content={t('dsb.base_info.danger.archive.modal.notice')} />

          <List
            items={[
              t('dsb.base_info.danger.archive.modal.item.posts'),
              t('dsb.base_info.danger.archive.modal.item.interactions'),
              t('dsb.base_info.danger.archive.modal.item.queue'),
            ]}
            left={6}
            top={5}
          />
        </div>
        <div className={s.footer}>
          <div className='grow' />
          <Button space={10} right={10} bottom={8} onClick={() => archiveCommunity()}>
            {t('dsb.base_info.danger.archive.modal.confirm')}
          </Button>
          <div className='grow' />
        </div>
      </div>
    </Modal>
  )
}

export default ArchiveModal
